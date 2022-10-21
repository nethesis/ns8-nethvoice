#!/bin/bash

find /etc/asterisk/ /var/lib/asterisk/sounds/ -type l -printf "%p %l\n" | while read LINK TARGET ; do 
	rm $LINK && cp $TARGET $LINK
done
