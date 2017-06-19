output=$(curl -s -XGET '192.168.0.204:9200/_cat/health')
res=$(echo $output | grep 'green')
if [ "$res" ] ;  then
 exit 0
fi
exit 1



