UPDATE CustomModOptions	SET Value = 1 WHERE Name = 'IPC_CHANNEL';
UPDATE CustomModOptions	SET Value = 1 WHERE Name like 'EVENTS_%';

INSERT INTO Flavors
	(Type)
VALUES
	('FLAVOR_MOBILIZATION');