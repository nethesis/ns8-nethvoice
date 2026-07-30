#!/bin/sh

set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repo_root=$(CDPATH= cd -- "$script_dir/.." && pwd)
php_files=$(mktemp)
route_attributes=$(mktemp)
trap 'rm -f "$php_files" "$route_attributes"' EXIT HUP INT TERM

find "$repo_root/freepbx" "$repo_root/tancredi" -type f -name '*.php' -print | sort > "$php_files"

while IFS= read -r file; do
    php -l "$file" >/dev/null
done < "$php_files"

file_count=$(wc -l < "$php_files" | tr -d ' ')
echo "PHP syntax check passed for $file_count files with PHP $(php -r 'echo PHP_MAJOR_VERSION, ".", PHP_MINOR_VERSION;')"

set -- \
    "$repo_root/freepbx/var/www/html/freepbx/rest" \
    "$repo_root/freepbx/var/www/html/freepbx/admin/modules" \
    "$repo_root/freepbx/usr/share/neth-hotel-fias" \
    "$repo_root/freepbx/usr/src/nethvoice" \
    "$repo_root/tancredi"

if find "$@" -type f -name '*.php' -exec grep -nH -E 'fetchAll.*\[[[:space:]]*0\]' {} +; then
    echo 'Direct indexing of fetchAll() results is forbidden; use fetch() or fetchColumn().' >&2
    exit 1
fi

if find "$@" -type f -name '*.php' -exec grep -nH -E 'fetch[[:space:]]*\([^)]*\)[[:space:]]*\[' {} +; then
    echo 'Direct indexing of fetch() results is forbidden; validate the returned row first.' >&2
    exit 1
fi

find "$repo_root/freepbx/var/www/html/freepbx/rest/modules" \
    -type f -name '*.php' \
    -exec grep -nH -E "getAttribute[[:space:]]*\([[:space:]]*['\"][^'\"]+['\"]" {} + \
    | grep -v -E "getAttribute[[:space:]]*\([[:space:]]*['\"]route['\"]" \
    > "$route_attributes" || true
if [ -s "$route_attributes" ]; then
    cat "$route_attributes"
    echo 'Slim route arguments must be read from $args or the route object.' >&2
    exit 1
fi

if find "$@" -type f -name '*.php' -exec grep -nH -E 'mysql_(connect|select_db|query|error|errno|real_escape_string)[[:space:]]*\(' {} +; then
    echo 'Removed mysql_* APIs are forbidden in active PHP sources.' >&2
    exit 1
fi

if find "$@" -type f -name '*.php' -exec grep -nH -E 'mktime[[:space:]]*\([[:space:]]*\)' {} +; then
    echo 'Zero-argument mktime() is forbidden; use time().' >&2
    exit 1
fi

phpcs="$script_dir/php-compatibility/vendor/bin/phpcs"
if [ ! -x "$phpcs" ]; then
    echo 'PHPCompatibility is not installed. Run composer install in tools/php-compatibility.' >&2
    exit 2
fi

(
    cd "$repo_root"
    "$phpcs" --standard=tools/php-compatibility/phpcs.xml
)
echo 'PHPCompatibility check passed for PHP 8.2'
