output "k3s_server" {
  description = "k3s server details"
  value = {
    name        = openstack_compute_instance_v2.k3s_server.name
    internal_ip = openstack_compute_instance_v2.k3s_server.access_ip_v4
    external_ip = openstack_networking_floatingip_v2.k3s_floatingip.address
  }
}

output "k3s_worker_ips" {
  description = "Private IP addresses of k3s worker nodes"
  value       = [for w in openstack_compute_instance_v2.k3s_workers : w.access_ip_v4]
}

output "ssh_command" {
  description = "SSH command to connect to the k3s server"
  value       = "ssh -i ${var.identity_file} ubuntu@${openstack_networking_floatingip_v2.k3s_floatingip.address}"
}

output "ansible_inventory_info" {
  description = "All server information needed for Ansible inventory"
  value = {
    server = {
      public_ip  = openstack_networking_floatingip_v2.k3s_floatingip.address
      private_ip = openstack_compute_instance_v2.k3s_server.access_ip_v4
    }
    workers = [
      for w in openstack_compute_instance_v2.k3s_workers : {
        name       = w.name
        private_ip = w.access_ip_v4
      }
    ]
  }
}

