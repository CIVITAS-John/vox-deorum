call cleanup-data

call cleanup-logs

git checkout main --force

git pull

git submodule update

cd scripts

call install