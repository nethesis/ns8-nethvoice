"""Read-only live Wizard E2E; optionally test local controllers before deployment.

Run with --url https://HOST/freepbx/wizard/ --username admin --local-ui.
The password is read from the terminal, never recorded in browser artifacts.
Requires Playwright and Chrome. No settings or PBX configuration are saved.
"""

import argparse
import getpass
import json
import re
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', required=True)
    parser.add_argument('--username', default='admin')
    parser.add_argument('--chrome', default='/usr/bin/google-chrome')
    parser.add_argument('--local-ui', action='store_true')
    options = parser.parse_args()
    password = getpass.getpass('Wizard password: ')
    ui = Path(__file__).resolve().parents[2] / 'freepbx/wizard-ui/app'
    base = options.url.rstrip('/') + '/'
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=options.chrome, headless=True, args=['--no-sandbox'])
        context = browser.new_context(viewport={'width': 1440, 'height': 1000})
        page = context.new_page()
        errors = []
        requests = []
        simulated_policy_error = False
        page.on('pageerror', lambda _: errors.append('javascript_error'))
        page.on('response', lambda response: requests.append((response.status,
                simulated_policy_error and response.url.endswith('/rest/agents/policy')))
                if '/freepbx/rest/agents/' in response.url else None)
        if options.local_ui:
            controllers = '\n'.join((ui / ('scripts/controllers/' + name + '.js')).read_text()
                                    for name in ('init', 'login', 'agents'))

            def local_controllers(route):
                response = route.fetch()
                route.fulfill(response=response, body=response.text() + '\n' + controllers)

            page.route('**/scripts/scripts.*.js', local_controllers)
        page.goto(base + '#!/agents', wait_until='networkidle')
        page.locator('#inputUsername').fill(options.username)
        page.locator('#inputPassword').fill(password)
        password = None
        page.get_by_role('button', name=re.compile('Sign in')).click()
        page.wait_for_url('**/#!/agents', timeout=20000)
        expect(page.locator('#agents-title')).to_be_visible(timeout=20000)
        expect(page.locator('.agents-area .alert-danger')).to_have_count(0)
        history = page.locator('.agents-area tbody a[href*="#!/agents/runs/"]')
        detail_checked = history.count() > 0
        if detail_checked:
            history.first.click()
            expect(page.locator('#agent-run-title')).to_be_visible(timeout=10000)
            expect(page.locator('.agents-facts')).to_be_visible()
            expect(page.locator('.agents-area .alert-danger')).to_have_count(0)
            page.locator('.agents-area a[href="#!/agents"]').click()
            expect(page.locator('#agents-title')).to_be_visible()
        page.locator('#agents-hours').select_option(label='1')
        with page.expect_response(lambda response: '/freepbx/rest/agents/overview' in response.url):
            page.locator('.agents-toolbar button[type=submit]').click()
        filters = page.locator('.agents-filters')
        filters.locator('select').first.select_option('external')
        with page.expect_response(lambda response: '/freepbx/rest/agents/runs?' in response.url):
            filters.locator('button[type=submit]').click()
        expect(page.locator('.agents-area .alert-danger')).to_have_count(0)
        page.locator('a[href="#!/agents/settings"]').click()
        expect(page.locator('#agents-settings-title')).to_be_visible()
        expect(page.locator('#agents-metadata-days')).to_be_visible(timeout=10000)
        expect(page.locator('.agents-area .alert-danger')).to_have_count(0)
        links = page.locator('.agents-cards a')
        expect(links).to_have_count(2)
        page.set_viewport_size({'width': 390, 'height': 844})
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1')
        page.set_viewport_size({'width': 1440, 'height': 1000})
        # A failed initial request must display an error, not leave the whole
        # view behind the spinner. This response is simulated, never a write.
        simulated_policy_error = True
        page.route('**/rest/agents/policy', lambda route: route.fulfill(status=503, json={'error': 'monitoring_unavailable'}))
        page.locator('a[href="#!/agents"]').last.click()
        expect(page.locator('#agents-title')).to_be_visible()
        page.locator('a[href="#!/agents/settings"]').click()
        expect(page.locator('.agents-area .alert-danger')).to_be_visible(timeout=10000)
        page.unroute('**/rest/agents/policy')
        simulated_policy_error = False
        page.locator('a[href="#!/agents"]').last.click()
        expect(page.locator('#agents-title')).to_be_visible()
        page.locator('a[href="#!/agents/settings"]').click()
        expect(page.locator('#agents-metadata-days')).to_be_visible(timeout=10000)
        # Opening configuration is read-only. Never submit the FreePBX form.
        href = page.locator('.agents-cards a[href*="tab=external"]').get_attribute('href')
        page.goto(options.url.split('/freepbx/')[0] + href, wait_until='networkidle')
        expect(page.locator('#external-prompt')).to_be_visible(timeout=10000)
        directory = page.locator('input[name^="directory["][name$="[allowed]"]')
        named_rows = page.locator('table tbody tr').filter(has=directory)
        # Count only: do not persist directory names or configured prompt contents.
        result = {'local_ui': options.local_ui, 'configuration_rows': named_rows.count(),
                  'allowed_destinations': page.locator('input[name^="directory["][name$="[allowed]"]:checked').count(),
                  'error_state_visible': True, 'run_detail_checked': detail_checked,
                  'javascript_errors': len(errors),
                  'agent_http_errors': sum(status >= 400 and not simulated for status, simulated in requests)}
        assert not errors and result['agent_http_errors'] == 0, result
        print(json.dumps(result))
        context.close()
        browser.close()


if __name__ == '__main__':
    try:
        main()
    except AssertionError:
        raise SystemExit('Browser assertion failed; page contents suppressed to protect configuration data.') from None
