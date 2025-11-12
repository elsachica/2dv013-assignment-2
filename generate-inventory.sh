
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

rm -f "$SCRIPT_DIR/ansible/inventory.ini"

SERVER_IP=$(terraform -chdir=terraform output -json ansible_inventory_info | jq -r '.server.public_ip')

terraform -chdir=terraform output -json ansible_inventory_info | \
jq -r --arg server_ip "$SERVER_IP" '
  "[k3s_servers]\n" +
  "k3s-server ansible_host=\($server_ip) ansible_user=ubuntu ansible_ssh_private_key_file=~/.ssh/eg223ps-keypair.pem\n\n" +
  "[k3s_workers]\n" +
  ([.workers[] | "\(.name) ansible_host=\(.private_ip) ansible_user=ubuntu ansible_ssh_private_key_file=~/.ssh/eg223ps-keypair.pem ansible_ssh_common_args='\''-o ProxyJump=ubuntu@\($server_ip) -o StrictHostKeyChecking=no'\''"] | join("\n")) +
  "\n\n[all:vars]\nansible_ssh_common_args='\''-o StrictHostKeyChecking=no'\''"
' > "$SCRIPT_DIR/ansible/inventory.ini"

echo "✅ Generated ansible/inventory.ini successfully!"
