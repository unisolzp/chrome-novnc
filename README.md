# Chromium with NoVNC

[![Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/unisolzp/chrome-novnc)

<p><b><h3>[ ! ] This project runs directly as a root user with non-sandboxed chromium! <br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;do not use in production environments.</h3></b></p>

## Environment variables: 
|      PORT      |                NoVNC HTTPS Port (Default: 9870)                |
|:--------------:|:--------------------------------------------------------------:|
|    VNC_PASS    |               VNC Password (Default: samplepass)               |
|    VNC_TITLE   |              VNC Session Title (Default: Chromium)             |
| VNC_RESOLUTION |               VNC Resolution (Default: 1280x720)               |
|    APP_NAME    |                Name of the app (Heroku specific)               |
|    NO_SLEEP    | Prevent app from sleeping (Heroku specific, default: disabled) |
