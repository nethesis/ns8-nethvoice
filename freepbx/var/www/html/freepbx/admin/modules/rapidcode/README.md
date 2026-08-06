# rapidcode

Easy Speed Dial alternative

# Status

This is a functioning module that manages notes. It installs and all that jazz on FreePBX 13\. It takes advantage of some 13 only stuff such as action buttons that won't show up in 12, and a dynamic grid that won't populate in 12.

# Structure

## Folder tree

- rapidcode

  - assets

    - js
    - css

  - views

  - assets

    - js
    - css

  - views

rapidcode - The name of your module

assets - Contains your CSS and Java Script files in their respective folders.

views - Contains the html page views. These files should generally not contain any logic.

## Files

```
rapidcode/Rapidcode.class.php
This is your primary class and is essentially your module. All the magic happens here.
```

```
rapidcode/module.xml
This is your module definition and is the same as previous FreePBX versions.
```

```
rapidcode/rapidcode.page.php
```

## Rapidcode.class.php

The standard here is first letter capitalized.

## Required methods (even if you don't use them)

This is th minimum methods allowed. There are other methods but these are manditory.

- public function install() {}
- public function uninstall() {}
- public function backup() {}
- public function restore($backup) {}
- public function doConfigPageInit($page) {}

### install method

replaces install.php

### uninstall method

clean up after your self

### backup method

FUTURE: generate an array that can be used to restore

### restore method

FUTURE: this will be given the array you generated prior which you should parse and make things the way they were.

### doConfigPageInit method

Without this you will get an error. This will process $_REQUEST

# Resources

Uniformity Guidelines: <http://wiki.freepbx.org/display/FOP/FreePBX+Development>

Code Snippits: <https://github.com/jfinstrom/FreePBX-gists>

## License

GPL
