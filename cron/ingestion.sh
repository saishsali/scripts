#!/usr/bin/env bash 
cd /home/ubuntu/dota-dns-scripts/'Ansible Playbooks'/zone_playbooks
ansible-playbook ingestion.yml -i ../dns-inventory.ini -e "dest_index=dns-full"
