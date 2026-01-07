call cleanup-data

call cleanup-logs

git checkout main --force

git pull

cd ../civ5-dll

git pull

cd scripts

call install