# Watchdog

I created this to automate my workflow and avoid manually SSH-ing into my Raspberry Pi to build the container and deploy it to the swarm, without needing to publish to a private registry.

```
¯\_(ツ)_/¯ 
```

![Let him cook](./.github/lhc.jpg)

# Start

To start the server, run:

```sh
exec -a dc-watchdog ruby server.rb -o 0.0.0.0 -p 9000 &
```

Then, you can kill it by name:

```sh
pkill dc-watchdog
```
