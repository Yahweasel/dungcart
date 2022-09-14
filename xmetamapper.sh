#!/bin/sh
BINDIR=$(dirname "$0")
METAMAPPER="$BINDIR/dung-cart-metamapper"
if [ ! -e "$METAMAPPER" ]
then
    METAMAPPER="$BINDIR/metamapper.sh"
fi

exec env \
    GDK_SCALE=1 \
    sakura \
    -f 'Pet Me 64 Bold 16' \
    -c 44 -r 32 \
    -e screen -S mapper "$METAMAPPER"
