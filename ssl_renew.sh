#!/bin/bash

COMPOSE="/usr/local/bin/docker-compose --no-ansi"
DOCKER="/usr/bin/docker"

cd /home/ec2-user/videochat
$COMPOSE run certbot renew && $COMPOSE kill -s SIGHUP webserver
$DOCKER system prune -af

# sudo crontab -e -> 0 0 */3 * * /home/ec2-user/videochat/ssl_renew.sh >> /var/log/cron.log 2>&1