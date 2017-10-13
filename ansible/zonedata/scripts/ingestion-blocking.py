import pika
import sys
import time
import json

# Which exchange should the data be sent to?
output_exchange = sys.argv[1]

host = '192.168.1.80'
credentials = pika.PlainCredentials('rabbitmqadmin', 'rabbitmqadmin')
parameters = pika.ConnectionParameters(credentials=credentials, host=host)


def connect(params):
    while True:
        try:
            return pika.BlockingConnection(parameters=params)
        except pika.exceptions.ConnectionClosed:
            time.sleep(2)
            continue


connection = connect(parameters)
channel = connection.channel()

for line in sys.stdin:
    m = {'message': line}
    channel.basic_publish(exchange=output_exchange, routing_key='', body=json.dumps(m),
                          properties=pika.BasicProperties(delivery_mode=2))

connection.close()
sys.exit(0)
