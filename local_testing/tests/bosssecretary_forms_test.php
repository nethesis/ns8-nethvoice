<?php
// Standalone regression: php local_testing/tests/bosssecretary_forms_test.php
// Render the real templates without FreePBX, Asterisk, or database access.
require __DIR__ . '/../../freepbx/var/www/html/freepbx/admin/modules/bosssecretary/functions.inc.php';

function checkBosssecretaryForm($condition, $message) {
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

set_error_handler(function ($severity, $message, $file, $line) {
    throw new ErrorException($message, 0, $severity, $file, $line);
});

try {
    $cases = [
        'missing messages' => [],
        'empty messages' => ['message_details' => [], 'message_title' => ''],
        'null messages' => ['message_details' => null, 'message_title' => null],
        'validation errors' => ['message_details' => ['Fixture error one', 'Fixture error two'], 'message_title' => 'Fixture errors'],
        'success message' => ['message_details' => ['Fixture saved'], 'message_title' => 'Fixture success'],
        'missing message title' => ['message_details' => ['Fixture message']],
    ];
    $fields = [
        'group_label' => 'Fixture group',
        'bosses' => ['9101', '9102'],
        'secretaries' => ['9201'],
        'chiefs' => ['9301'],
    ];

    $blank = bosssecretary_get_form_add([]);
    checkBosssecretaryForm(strpos($blank, '<h5>Add Group</h5>') !== false, 'Initial Add Group form missing');
    checkBosssecretaryForm(strpos($blank, 'name= "group_label" value=""') !== false, 'Initial label is not blank');
    foreach (['bosses', 'secretaries', 'chiefs'] as $role) {
        checkBosssecretaryForm(strpos($blank, '<textarea name="' . $role . '_extensions"></textarea>') !== false, 'Initial extension field is not blank');
    }

    foreach (['add', 'edit'] as $mode) {
        $params = $fields;
        if ($mode === 'edit') {
            $params['group_number'] = '99';
        }
        foreach ($cases as $case => $messages) {
            $render = 'bosssecretary_get_form_' . $mode;
            $html = $render($params + $messages);
            $context = $mode . ': ' . $case;
            checkBosssecretaryForm(strpos($html, 'name="submit' . ucfirst($mode) . '"') !== false, $context . ': Save control missing');
            checkBosssecretaryForm(strpos($html, 'name="clean' . ucfirst($mode) . '"') !== false, $context . ': Clean control missing');
            checkBosssecretaryForm(strpos($html, 'value="Fixture group"') !== false, $context . ': label changed');
            foreach (['bosses', 'secretaries', 'chiefs'] as $role) {
                $expected = '<textarea name="' . $role . '_extensions">' . implode("\n", $fields[$role]) . '</textarea>';
                checkBosssecretaryForm(strpos($html, $expected) !== false, $context . ': extension selections changed');
            }

            $details = $messages['message_details'] ?? [];
            if ($details) {
                $expected = '<h5>' . ($messages['message_title'] ?? '') . '</h5><ul>';
                foreach ($details as $detail) {
                    $expected .= '<li>' . $detail . '</li>';
                }
                $expected .= '</ul>';
                checkBosssecretaryForm(strpos($html, $expected) !== false, $context . ': message output changed');
            } else {
                checkBosssecretaryForm(strpos($html, '<ul>') === false, $context . ': empty message list rendered');
            }
            checkBosssecretaryForm(strpos($html, '{messages}') === false, $context . ': message placeholder unresolved');
            if ($mode === 'edit') {
                checkBosssecretaryForm(strpos($html, 'name="group_number" value="99"') !== false, $context . ': group number changed');
                checkBosssecretaryForm(strpos($html, 'bsgroupdelete=bsgroup-99') !== false, $context . ': delete link changed');
            }
        }
    }
    echo 'PASS: Boss/Secretary Add/Edit forms, empty metadata, messages and entered fields (PHP ', PHP_VERSION, ")\n";
} finally {
    restore_error_handler();
}
