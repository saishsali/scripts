# read config json file at /home/ubuntu/dota-dns-scripts/czdap-tools/zonedata-download/
# at ['nick_b.json', 'nick_g.json', 'nick_r.json']
# get base_url and token

# download `base_url`/user-zone-data-urls.json?token=`token`
# get a list of available zones

# download each zone and name them with
# parsed_url = headers['content-disposition']
# original_name = parsed_url[parsed_url.find('"')+1:len(parsed_url)-1]
# date = original_name[:4] + '-' + original_name[4:6] + '-' + original_name[6:8]
# dash_index = original_name.find('-')
# tld = original_name[dash_index+1: original_name.find('-zone')]
# if not tld:
#     tld = 'zone'
# filename = tld + '.' + date

# make sure todays_download_directory exist
# write zone file to todays_download_directory + '/' + filename + '.zone.gz'

# check file integrity

DEBUG = False

import requests
import json
import sys
from urlparse import urlparse
import os
import subprocess
import traceback
import shlex

todays_download_directory = sys.argv[1]
yesterdays_download_directory = sys.argv[2]
mail_command = 'mail dnsanalyticsofficial@gmail.com '
if 'email_list' in os.environ:
    mail_command = 'mail ' + os.environ['email_list']

# collect all config files
config_file_path_arr = []
for path in sys.argv[3:]:
    config_file_path_arr.append(path)

def main():
    session = requests.Session()
    # get at least one valid file list
    zones_url = None
    config = None
    for config_file_path in config_file_path_arr:
        try:
            config = load_config(config_file_path)
            zones_url = get_urls(session, config)
        except Exception as e:
            sys.stderr.write("fail to load config " + config_file_path + "\n")
            traceback.print_exc()
            continue
    if zones_url is None:
        p = subprocess.Popen(shlex.split(mail_command + ' -s "zone list download failed"'), stdin=subprocess.PIPE)
        p.communicate(input="zone list download failed")
        sys.stderr.write("all zone config load failed. error mailed..\n")
        exit(1)
    print("config file loaded")

    # download zones
    zones_url_err = []
    for index, zone_url in enumerate(zones_url):
        valid = False
        for i in range(0, 3):
            try:
                if DEBUG and index > 10:
                    raise Exception("DEBUG manual failure")
                download_zone(session, config['base_url'] + zone_url, todays_download_directory)
                valid = True
            except Exception as e:
                sys.stderr.write(e.message + "\n")
                continue
        if not valid:
            sys.stderr.write("all retry used for " + zone_url + "\n")
            zones_url_err.append(zone_url)
        else:
            print("zone downloaded("+str(index)+"/"+str(len(zones_url))+"): " + zone_url)
    print("all zone downloaded")

    # collect zone changes
    missing_zones = get_missing_zones(todays_download_directory, yesterdays_download_directory)
    print("zone changes collected")

    # send report
    if len(zones_url_err) != 0:
        p = subprocess.Popen(shlex.split(mail_command + ' -s "zone download FAIL list"'), stdin=subprocess.PIPE)
        p.communicate(input="\n".join(zones_url_err))
    if len(missing_zones) != 0:
        p = subprocess.Popen(shlex.split(mail_command + ' -s "zone changes"'), stdin=subprocess.PIPE)
        p.communicate(input="\n".join(missing_zones))
    print("report sent")


def load_config(config_file_path):
    # Load the config file
    try:
        config_file = open(config_file_path, "r")
        config = json.load(config_file)
        config_file.close()
    except:
        raise Exception("Error loading config.json file.")
    if 'token' not in config:
        raise AttributeError("'token' parameter not found in the config.json file")
    if 'base_url' not in config:
        raise AttributeError("'base_url' parameter not found in the config.json file")
    return config


def get_urls(session, config):
    # Get all the files that need to be downloaded using CZDAP API.
    r = session.get(config['base_url'] + '/user-zone-data-urls.json?token=' + config['token'])
    if r.status_code != 200:
        sys.stderr.write("Unexpected response from CZDAP. Are you sure your token and base_url are correct in config.json?\n")
        exit(1)
    try:
        urls = json.loads(r.text)
    except:
        sys.stderr.write("Unable to parse JSON returned from CZDAP.\n")
        exit(1)
    return urls


def download_zone(session, url, dest):
    if not os.path.exists(dest):
        os.makedirs(dest)
    res = session.get(url)
    if res.status_code != 200:
        raise Exception("zone url download return non 200 code")
    content_dis = res.headers['content-disposition']
    original_name = content_dis[content_dis.find('"') + 1:len(content_dis) - 1]
    date = original_name[:4] + '-' + original_name[4:6] + '-' + original_name[6:8]
    dash_index = original_name.find('-')
    tld = original_name[dash_index+1: original_name.find('-zone')]
    if not tld:
        tld = 'zone'
    filename = tld + '.' + date
    out_path = dest + '/' + filename + '.zone.gz'
    with open(out_path, 'wb') as f:
        for chunk in res.iter_content(1024):
            f.write(chunk)
    valid = subprocess.call(shlex.split('gzip -t ' + out_path))
    if valid != 0:
        os.remove(out_path)
        raise Exception("zone file download from " + url + " is invalid")


def get_missing_zones(todays_directory, yesterdays_directory):
    cmd = "comm <(ls " + yesterdays_directory + " | cut -d . -f1) <(ls " + \
          todays_directory + " | cut -d . -f1)"
    comm_output = subprocess.check_output(cmd, shell=True, executable='/bin/bash').rstrip()
    if comm_output == '':
        return []
    missing_zones_arr = comm_output.split('\n')
    return missing_zones_arr

main()
