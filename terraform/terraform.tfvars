# Configuration for k3s OpenStack deployment
key_pair_name = "eg223ps-keypair" # The name of your key pair created in OpenStack
identity_file = "~/.ssh/eg223ps-keypair.pem"      # The path to your private SSH key

# Optional: Customize these if needed
flavor_name = "c1-r1-d40"           # 2 cores, 2GB RAM, 10GB storage (default)
server_name = "k3s-server"          # Name for the k3s server (default)
base_name = "elsa-assignment2"                   # Prefix for network resources (default)
subnet_cidr = "192.168.4.0/24"     # CIDR for the internal network (default)