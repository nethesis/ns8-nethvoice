# DirectDID FreePBX Module
DirectDID FreePBX module allow to configure direct did with alternative destinations in case of failure.
This module is useful When a DID Number with pattern is created (like _1234567XX) and we want to direct all numbers that match the pattern to an extension like:

123456700 -> 300

123456701 -> 301

123456722 -> 322

...

This could already be done using direct did on extension option, but configuring it with this module is faster and also allow to chose a different failure destination that overrides the extension's

## Configuration

You can find module interface in FreePBX menu under Applications->DirectDID

Adding a new DirectDID creates a destinations that inbound routes can use

DID Root is just a label, but it's useful to configure it to spot the right direct did if you have more than one. You can write here the inbound routes pattern

Variable Length is the number of digit that are variable in the DID and correspond to the number of "X" in the DID. If the DID is _12345678XX, Variable length is 2

Extension Prefix is the number to prepend to the variable to obtain the extension number. If DID is _12345678XX, and 3 digit extensions are used with extension number 2XX, Extension Prefix is 2. If variable is 2 and extensions are of two digit, this field is empty

Timeout is the ringing timeout before going to timeout destination.

Timeout Destination, Busy Destination and Unavailable Destination are the destinations that override extension's if call pass through this module

# Resources

Code Snippits: <https://github.com/jfinstrom/FreePBX-gists>

## License

GPL
