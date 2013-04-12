#!/bin/bash

LOG_DIR=/var/log/singingbank.com/live
LOG_FILE=$LOG_DIR/singingbank-live.log

PID_FILE=/var/run/nodejs-singingbank-live.pid

if [ -a $PID_FILE ]
then
    forever --pidFile $PID_FILE stop app.js
    echo "Stopping NodeJS app"
    echo "Stopping NodeJS app" >> $LOG_FILE
    exit 0 
else
    echo "Can't find a running PID"
fi

