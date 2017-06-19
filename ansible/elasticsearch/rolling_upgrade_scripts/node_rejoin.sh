res=$(curl -s -XGET '192.168.0.204:9200/_cat/nodes' | grep $1 | grep $2)
if [ "$res" ] ;  then
 exit 0
fi
exit 1



