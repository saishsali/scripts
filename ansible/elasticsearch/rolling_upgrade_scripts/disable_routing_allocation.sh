output=$(curl -s -XPUT '192.168.0.204:9200/_cluster/settings?pretty' -H 'Content-Type: application/json' -d' { "transient": { "cluster.routing.allocation.enable": "none" } } ')
res=$(echo $output | grep '"acknowledged" : true')
if [ "$res" ] ;  then
 exit 0
fi
exit 1



