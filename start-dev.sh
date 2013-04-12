#!/bin/bash
PROJECT_FOLDER=/var/www/singingbank.com/dev/SingingBank/

LOG_DIR=/var/log/singingbank.com/dev
LOG_FILE=$LOG_DIR/singingbank-dev.log
ERROR_LOG_FILE=$LOG_DIR/singingbank-dev-error.log

USER=www-data
GROUP=www-data

NODE_ENV=staging

PID_FILE=/var/run/nodejs-singingbank-dev.pid

if [ -a $LOG_FILE ]
  then
    mv  $LOG_FILE $LOG_FILE-`date +%F_%k:%M`
    touch $LOG_FILE
  else
    touch $LOG_FILE
fi

chown -R $USER:$GROUP $LOG_DIR 
chown $USER:$GROUP $LOG_FILE 
cd $PROJECT_FOLDER; NODE_ENV=$NODE_ENV forever --pidFile $PID_FILE -a -l $LOG_FILE -e $ERROR_LOG_FILE -w start app.js
echo -n "PID:`cat $PID_FILE| tr -d \"\n\"`"
echo
