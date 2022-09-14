#!/bin/sh
BINDIR=$(dirname "$0")
MAPPER="$BINDIR/dung-cart"
if [ ! -e "$MAPPER" ]
then
    MAPPER="$BINDIR/mapper.js"
fi

CHARSET="charset/lines.json"
while true
do
    clear
    /usr/bin/printf '\x1b[m\x1b[97m\x1b]2;Dung Cart mapper\x07Current maps: '
    ls *.map 2> /dev/null | sed 's/\.map//' | fmt -w 1000

    printf '\n'
    read -p 'Map? ' MAP

    if expr "$MAP" : 'charset/' > /dev/null 2>&1
    then
        CHARSET="$MAP.json"
    else
        "$MAPPER" "$MAP".map "$CHARSET"
    fi
done
