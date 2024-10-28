# Prepare the script that stops the container
# The .sh file is sourced by the Bash entrypoint script
# because it is not an executable file:
docker_temp_server_stop # function defined by the entrypoint script
exit 0 # exit the entrypoint immediately: do not start the real DB server
