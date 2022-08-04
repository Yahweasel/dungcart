#!/bin/sh
while true
do
    clear
    /usr/bin/printf '\x1b[m\x1b[97mCurrent maps: '
    ls *.map 2> /dev/null | sed 's/\.map//' | fmt -w 1000

    printf '\n'
    read -p 'Map? ' MAP

    ./mapper.js "$MAP".map
done
