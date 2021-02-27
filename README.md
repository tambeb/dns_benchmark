# About
Very crude DNS benchmark tool

## Setup
You should preferably do this in Linux or WSL in Windows. See setup info for WSL [here](https://docs.microsoft.com/en-us/windows/wsl/install-win10).

First, install Node if you don't already have it:
```
curl -sL https://deb.nodesource.com/setup_15.x | sudo -E bash -
sudo apt-get install -y nodejs
```
Then:
```
git clone https://github.com/tambeb/dns_benchmark.git
cd dns_benchmark
npm install
```
On the Linux/WSL side you need to be able to run getdns_query and dig:
```
sudo apt-get update
sudo apt-get install getdns-utils dnsutils
```
## Use
To run all four types of DNS requests on all the targets in the settings file:
```
node benchmark protocol=dns,dnstcp,doh,dot category=ad,top target=blockerdns1,blockerdns2,blockerdns3,blockerdns4,nextdns1,nextdns2,cleanbrowsing1,cleanbrowsing2,adguard1,adguard2
```
Note: For blockerDNS, NextDNS and CleanBrowsing you need to be registered and have a user ID which then gets put into the settings file.

Average query response times will be shown in the console, and individual query response times will be saved to CSV and JSON files.