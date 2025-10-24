.before_script_ssh_setup: &before_script_ssh_setup
  # Ensure ssh-agent is installed and started, essential for managing SSH keys.
  # (Change apt-get to yum if using an RPM-based image)
  - command -v ssh-agent >/dev/null || ( apt-get update -y && apt-get install openssh-client -y )

  # Start the ssh-agent in the background.
  - eval $(ssh-agent -s)

  # Add the SSH private key stored in the SSH_PRIVATE_KEY variable to the ssh-agent.
  # Using 'tr' to remove carriage return characters for compatibility with ed25519 keys.
  # Reference: https://gitlab.com/gitlab-examples/ssh-private-key/issues/1#note_48526556
  - echo "$SSH_PRIVATE_KEY" | tr -d '\r' | ssh-add -

  # Create the .ssh directory and set the correct permissions.
  - mkdir -p ~/.ssh
  - chmod 700 ~/.ssh

  # Use ssh-keyscan to add the remote server's SSH key to the known_hosts file.
  # This prevents SSH from prompting for approval of the remote server's key.
  - ssh-keyscan -H $REMOTE_HOST >> ~/.ssh/known_hosts
  - chmod 644 ~/.ssh/known_hosts

# Specify the Docker image to be used for the jobs, which supports Docker commands.
image: docker:27-cli

# Define the stages of the pipeline and their order of execution.
stages:
  - build
  - test
  - deploy

# Job to compile the code in the build stage.
build-job:
  stage: build
  script:
    - echo "Compiling the code..."
    - sleep 2 # Simulate compilation time.
    - echo "Compile complete."

# Job to run unit tests in the test stage.
unit-test-job:
  stage: test # Runs after the build stage is successful.
  script:
    - echo "Running unit tests... This will take about 60 seconds."
    - sleep 2 # Simulate test time.
    - echo "Code coverage is 90%"

# Job to lint the code in the test stage, can run in parallel with unit-test-job.
lint-test-job:
  stage: test
  script:
    - echo "Linting code... This will take about 10 seconds."
    - sleep 2 # Simulate linting time.
    - echo "No lint issues found."

# Job to deploy to the staging environment.
deploy_staging_job:
  stage: deploy
  environment:
    name: staging
    url: http://$STAGING_HOST
  variables:
    REMOTE_HOST: $STAGING_HOST # Set the REMOTE_HOST variable for staging.
    DOCKER_HOST: ssh://ubuntu@$REMOTE_HOST # Docker connection via SSH.
  before_script: *before_script_ssh_setup # Reuse SSH setup steps.
  script:
    - echo "Deploying to staging..."
    - docker compose -f docker-compose.yaml -f docker-compose.production.yaml up --build -d
  only:
    - deploy # Only run this job on the deploy branch.

# Manual approval step before deploying to production.
manual_approval_step:
  stage: deploy
  script:
    - echo "Manual approval required before deploying to production."
  when: manual # This job requires manual intervention.
  only:
    - deploy

# Job to deploy to the production environment.
deploy_production_job:
  stage: deploy
  environment:
    name: production
    url: http://$PRODUCTION_HOST
  variables:
    REMOTE_HOST: $PRODUCTION_HOST # Set the REMOTE_HOST variable for production.
    DOCKER_HOST: ssh://ubuntu@$REMOTE_HOST # Docker connection via SSH.
  before_script: *before_script_ssh_setup # Reuse SSH setup steps.
  script:
    - echo "Deploying to production..."
    - docker compose -f docker-compose.yaml -f docker-compose.production.yaml up --build -d
  only:
    - deploy # Only run this job on the deploy branch.
  needs:
    - manual_approval_step # This job depends on the manual approval step.
