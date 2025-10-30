resource "openstack_compute_instance_v2" "k3s_server" {
  depends_on = [
    openstack_networking_router_interface_v2.router_interface
  ]
  name              = var.server_name
  image_id          = data.openstack_images_image_v2.image.id
  flavor_id         = data.openstack_compute_flavor_v2.flavor.id
  key_pair          = var.key_pair_name
  availability_zone = "Education"
  user_data         = local.cloud_init
  network {
    port = openstack_networking_port_v2.k3s_port.id
  }
}

resource "openstack_networking_port_v2" "k3s_worker_ports" {
  count              = var.worker_count
  name               = "${var.worker_port_prefix}${count.index + 1}"
  network_id         = openstack_networking_network_v2.network.id
  admin_state_up     = true
  security_group_ids = [openstack_networking_secgroup_v2.secgroup.id]
  fixed_ip {
    subnet_id = openstack_networking_subnet_v2.subnet.id
  }
}

resource "openstack_compute_instance_v2" "k3s_workers" {
  count             = var.worker_count
  name              = "${var.worker_name_prefix}${count.index + 1}"
  image_id          = data.openstack_images_image_v2.image.id
  flavor_id         = data.openstack_compute_flavor_v2.flavor.id
  key_pair          = var.key_pair_name
  availability_zone = "Education"
  user_data         = local.cloud_init
  network {
    port = openstack_networking_port_v2.k3s_worker_ports[count.index].id
  }
  depends_on = [
    openstack_networking_router_interface_v2.router_interface
  ]
}