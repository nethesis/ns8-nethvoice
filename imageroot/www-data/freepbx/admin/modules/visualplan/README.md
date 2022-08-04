# visualplan

Visual Plan is intuitive graphic mode to create new route

# Status

This is a functioning module that manages notes. It installs and all that jazz on FreePBX 13\. It takes advantage of some 13 only stuff such as action buttons that won't show up in 12, and a dynamic grid that won't populate in 12.

# Structure

## Folder tree

- visualplan

  - assets

    - js
    - css

  - views

  - assets

    - js
    - css

  - views

visualplan - The name of your module

assets - Contains your CSS and Java Script files in their respective folders.

views - Contains the html page views. These files should generally not contain any logic.

## Files

```
visualplan/Visualplan.class.php
This is your primary class and is essentially your module. All the magic happens here.
```

```
visualplan/module.xml
This is your module definition and is the same as previous FreePBX versions.
```

```
visualplan/visualplan.page.php
```

## Visualplan.class.php

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

# How to build

This module is embedded into nethserver-nethvoice14 build

building nethserver-nethvoice14 without signing key embed this module last master

To embed this module into nethserver-nethvoice14 release build
- create a new release on github in the repo of this module
- make a PR on nethserver-nethvoice14 changing module version in retrieve_modules.sh
- as commit message, include release changelog
- now, builds and automatic builds for testing and relese (with signing passphrase) will include specified version

