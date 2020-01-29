# Video Chat
Secure WebRTC video conferencing application

# Running the app for development
`npm install && npm run build:dev && npm run server`

# Running the app for production
`npm install && npm run build:prod && npm run server`

*Note here, to run the service with docker-compose you'll need to run the webserver infrastructure package from this [link](https://github.com/damishshah/webserver-infrastructure). This infrastructure package runs an instance of nginx and can help you set up an automated certbot to acquire an certs from letsencrypt for your website. It also sets up the docker network that the docker-compose file in this package depends on. 

# Accessing the app
http://localhost:8080

