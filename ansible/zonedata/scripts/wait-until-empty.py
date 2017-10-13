import requests
import sys
import time

q = sys.argv[1]

host = '192.168.1.80'
user = 'rabbitmqadmin'
passwd = 'rabbitmqadmin'

url = 'http://{}:{}@{}:15672/api/queues/%2f/{}'.format(user, passwd, host, q)

while True:
    r = requests.get(url)
    json = r.json()
    if json['messages_unacknowledged'] or json['messages_ready']:
        time.sleep(5)
    else:
        sys.exit(0)
