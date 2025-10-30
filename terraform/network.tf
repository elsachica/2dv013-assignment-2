#--------------------------------------------------------------------
# Create a router
#

resource "openstack_networking_router_v2" "router" {
  name                = local.router_name
  external_network_id = data.openstack_networking_network_v2.extnet.id
}

#--------------------------------------------------------------------
# Create networks
#

resource "openstack_networking_network_v2" "network" {
  name = local.network_name
}

resource "openstack_networking_subnet_v2" "subnet" {
  name            = local.subnet_name
  network_id      = openstack_networking_network_v2.network.id
  cidr            = var.subnet_cidr
  ip_version      = 4
  enable_dhcp     = true
  dns_nameservers = ["8.8.8.8", "8.8.4.4"]
}

resource "openstack_networking_router_interface_v2" "router_interface" {
  router_id = openstack_networking_router_v2.router.id
  subnet_id = openstack_networking_subnet_v2.subnet.id
}

#--------------------------------------------------------------------
# Create a security group for k3s cluster
#

resource "openstack_networking_secgroup_v2" "secgroup" {
  name        = local.secgroup_name
  description = "Allow SSH and Kubernetes traffic"
}

# SSH access
resource "openstack_networking_secgroup_rule_v2" "ssh" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 22
  port_range_max    = 22
  remote_ip_prefix  = "0.0.0.0/0"
  security_group_id = openstack_networking_secgroup_v2.secgroup.id
}

# Kubernetes API server
resource "openstack_networking_secgroup_rule_v2" "k8s_api" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 6443
  port_range_max    = 6443
  remote_ip_prefix  = "0.0.0.0/0"
  security_group_id = openstack_networking_secgroup_v2.secgroup.id
}

# HTTP for ingress
resource "openstack_networking_secgroup_rule_v2" "http" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 80
  port_range_max    = 80
  remote_ip_prefix  = "0.0.0.0/0"
  security_group_id = openstack_networking_secgroup_v2.secgroup.id
}

# HTTPS for ingress
resource "openstack_networking_secgroup_rule_v2" "https" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 443
  port_range_max    = 443
  remote_ip_prefix  = "0.0.0.0/0"
  security_group_id = openstack_networking_secgroup_v2.secgroup.id
}

# NodePort services range (includes monitoring ports)
resource "openstack_networking_secgroup_rule_v2" "nodeport" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 30000
  port_range_max    = 32767
  remote_ip_prefix  = "0.0.0.0/0"
  security_group_id = openstack_networking_secgroup_v2.secgroup.id
}

#--------------------------------------------------------------------
# Create port for k3s server
#

resource "openstack_networking_port_v2" "k3s_port" {
  name       = local.port_name
  network_id = openstack_networking_network_v2.network.id
  security_group_ids = [
    data.openstack_networking_secgroup_v2.secgroup_default.id,
    openstack_networking_secgroup_v2.secgroup.id
  ]
  admin_state_up = "true"
  fixed_ip {
    subnet_id = openstack_networking_subnet_v2.subnet.id
  }
}

#--------------------------------------------------------------------
# Get the floating IP for k3s server
#

resource "openstack_networking_floatingip_v2" "k3s_floatingip" {
  pool = var.external_network_name
  depends_on = [
    openstack_networking_router_interface_v2.router_interface
  ]
}

#--------------------------------------------------------------------
# Associate the floating IP to the port
#

resource "openstack_networking_floatingip_associate_v2" "k3s_floatingip_association" {
  floating_ip = openstack_networking_floatingip_v2.k3s_floatingip.address
  port_id     = openstack_networking_port_v2.k3s_port.id
  depends_on = [
    openstack_networking_router_interface_v2.router_interface,
    openstack_networking_floatingip_v2.k3s_floatingip,
    openstack_networking_port_v2.k3s_port
  ]
}
