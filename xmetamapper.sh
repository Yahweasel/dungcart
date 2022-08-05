#!/bin/sh
exec env \
    GDK_SCALE=1 \
    sakura \
    -f 'Pet Me 64 Bold 16' \
    -c 44 -r 32 \
    -e screen -S mapper ./metamapper.sh
