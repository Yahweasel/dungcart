#!/bin/sh
while true
do
    WINID="$(xdotool search --name 'Dung Cart mapper')"
    ffmpeg -f x11grab -window_id "$WINID" -framerate 10 -i :0 \
        -filter_complex '
        [0:v]pad=w=960:h=720:x=(960-iw)/2:y=(720-ih)/2,split[vid][bg];
        [bg]colorize=120:1:0.5:0[bg];
        [vid]split[vid][alpha];
        [alpha]eq=contrast=1000,colorkey=black,format=yuva444p,alphaextract,dilation,dilation,dilation,dilation,dilation,dilation,dilation,dilation[alpha];
        [vid][alpha]alphamerge[vid];
        [bg][vid]overlay[vid]' \
        -map '[vid]' -pix_fmt yuv420p -f v4l2 /dev/video1
    sleep 1
done
