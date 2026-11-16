# nethcti.rb

Facter.add('nethcti') do
  confine :osfamily => 'RedHat'
  setcode do
    nethcti = {}
    tmp = Facter::Core::Execution.exec('curl http://localhost:8179/profiling/all 2> /dev/null')
    if ! tmp.empty?
        nethcti = JSON.parse(tmp)
    end
    tmp = Facter::Core::Execution.exec('ls -tr /var/log/asterisk/nethcti.log* | tail -n2 | xargs zgrep -a "^$(date +%Y-%m-%d --date="yesterday")T.*wsid conn [0-9]*$" | rev | cut -d" " -f1 | rev | sort -n | tail -n1 2>/dev/null')
    if ! tmp.empty?
        nethcti['conn_clients']['daily_max_ws_conn_clients'] = tmp
    else
        nethcti['conn_clients']['daily_max_ws_conn_clients'] = 0
    end

    nethcti
  end
end
