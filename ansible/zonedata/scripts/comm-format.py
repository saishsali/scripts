#!/usr/bin/env python3
import argparse
import datetime
import sys

NS_TYPE = 'NS'
A_TYPE = 'A'
DATE_SUFFIX = 'T10:00:00.000-0500'
UPDATE = '~'
REG = '+'
DEREG = '-'


def write_data(**kwargs):
    zone = kwargs['zone']
    time = kwargs['time']
    status = kwargs['status']
    domain = kwargs['domain']
    _type = kwargs['type']
    content = kwargs['content']
    sys.stdout.write('{} {} {} {} {} {}\n'.format(zone, time, status, domain, _type, content))


def is_ip(data):
    data = data.split('.')
    if len(data) != 4:
        return False
    try:
        for segment in data:
            val = int(segment)
            if not (0 <= val <= 255):
                return False
    except ValueError:
        return False
    return True


def get_data(yest, today, comm):
    len_yest = len(yest)
    len_today = len(today)
    len_comm = len(comm)
    data = None
    status = None
    if len_today != 0 and len_yest != 0:
        if len_comm != 0:
            data = today + comm
        else:
            data = today
        status = UPDATE
    elif len_today != 0:
        if len_comm != 0:
            data = today + comm
            status = UPDATE
        else:
            data = today
            status = REG
    elif len_yest != 0:
        if len_comm != 0:
            data = comm
            status = UPDATE
        else:
            data = []
            status = DEREG
    else:
        return None, None
    content = ''
    for segment in data:
        content += ' ' + segment

    return content.lstrip(), status


def parse_line(line):
    try:
        parsed_line = line.upper().split(' ')
        tokens = len(parsed_line)
        if tokens == 1:
            parsed_line = line.upper().split('\t')
            tokens = len(parsed_line)
            if tokens == 5:
                parsed_line = [parsed_line[0], parsed_line[3], parsed_line[4]]
            elif tokens == 6:
                parsed_line = ['\t' + parsed_line[1], parsed_line[4], parsed_line[5]]
            elif tokens == 7:
                parsed_line = ['\t\t' + parsed_line[2], parsed_line[5], parsed_line[6]]
            else:
                return None
        elif tokens != 3:
            return None
        if parsed_line[1].upper() != 'NS' and parsed_line[1].upper() != 'A':
            return None
        if parsed_line[0].strip().find('\t') > 0:
            return None
        return parsed_line
    except IndexError:
        return None


def main(args):
    delta_date = args.DATE
    tld = '.' + args.ZONE.upper() + '.'
    try:
        delta_date_split = delta_date.split('-')
        y = int(delta_date_split[0])
        m = int(delta_date_split[1])
        d = int(delta_date_split[2])
        date = datetime.date(year=y, month=m, day=d)
    except (TypeError, ValueError):
        print('ERROR: Improper input file date from file')
        sys.exit(1)

    yest_data = []
    today_data = []
    comm_data = []
    domain = ''
    _type = ''
    first = True
    for line in sys.stdin:
        if line[-1] == '\n':
            line = line[:-1]
        parsed_line = parse_line(line)
        if not parsed_line:
            continue

        domain_check = parsed_line[0].strip()
        ends_with_tld = domain_check.endswith(tld) or domain_check == tld[1:]
        if not ends_with_tld:
            domain_check += tld

        if (domain != domain_check or _type != parsed_line[1]) and not first:
            content, status = get_data(yest_data, today_data, comm_data)
            timestamp = delta_date + DATE_SUFFIX
            if status:
                write_data(zone=args.ZONE, time=timestamp, status=status, domain=domain, type=_type,
                           content=content)
            yest_data, today_data, comm_data = [], [], []

        col = len(parsed_line[0].split('\t'))
        if parsed_line[2][-1] != '.' and not is_ip(parsed_line[2]):
            parsed_line[2] += tld
        if col == 1:
            yest_data.append(parsed_line[2])
        elif col == 2:
            today_data.append(parsed_line[2])
        else:
            comm_data.append(parsed_line[2])

        _type = parsed_line[1]
        domain = domain_check
        first = False

    content, status = get_data(yest_data, today_data, comm_data)
    timestamp = delta_date + DATE_SUFFIX
    if status:
        write_data(zone=args.ZONE, time=timestamp, status=status, domain=domain, type=_type,
                   content=content)


class ArgParser(argparse.ArgumentParser):
    def error(self, message):
        print('Error: {}'.format(message))
        self.print_help()
        exit(2)


if __name__ == '__main__':
    parser = ArgParser(prog='comm-format', description='Convert comm file to formatted delta.')
    parser.add_argument('DATE', type=str, help='The date being processed.')
    parser.add_argument('ZONE', type=str, help='The zone being processed.')
    main(parser.parse_args())
