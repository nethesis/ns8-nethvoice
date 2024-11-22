# Prepare the script that stops the container
# The .sh file is sourced by the Bash entrypoint script
# because it is not an executable file:
mysql_note "Stopping temporary server"
docker_temp_server_stop # function defined by the entrypoint script
mysql_note "Temporary server stopped"
echo
mysql_note "MariaDB init process done. Ready for start up."
echo
exit 0 # exit the entrypoint immediately: do not start the real DB server
