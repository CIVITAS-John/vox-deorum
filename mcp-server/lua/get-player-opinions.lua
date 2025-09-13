local L = Locale.Lookup;

-- Returns a table of opinion strings without any formatting
function GetOpinions(eFirstPlayer, eOtherPlayer)
	local pFirstPlayer = Players[eFirstPlayer];
	local eFirstTeam = pFirstPlayer:GetTeam();
	local pFirstTeam = Teams[eFirstTeam];
	local pOtherPlayer = Players[eOtherPlayer];
	local eOtherTeam = pOtherPlayer:GetTeam();
	local pOtherTeam = Teams[eOtherTeam];
	local iVisibleApproach = pFirstPlayer:GetApproachTowardsUsGuess(eOtherPlayer);
	local opinions = {};

	-- Always war!
	if pFirstTeam:IsAtWar(eOtherTeam) then
		if Game.IsOption(GameOptionTypes.GAMEOPTION_ALWAYS_WAR) or Game.IsOption(GameOptionTypes.GAMEOPTION_NO_CHANGING_WAR_PEACE) then
			table.insert(opinions, L("TXT_KEY_ALWAYS_WAR_TT"));
			return opinions;
		end
	end

	-- Get the opinion modifier table from the DLL
	local tOpinion = pOtherPlayer:GetOpinionTable(eFirstPlayer);
	if next(tOpinion) then
		return tOpinion;
	end

	-- No specific modifiers are visible, so let's see what string we should use (based on visible approach towards us)
	-- Eliminated
	if not pOtherPlayer:IsAlive() then
		table.insert(opinions, L("TXT_KEY_DIPLO_ELIMINATED_INDICATOR"));
		return opinions;
	end

	-- Teammates
	if eFirstTeam == eOtherTeam then
		table.insert(opinions, L("TXT_KEY_DIPLO_HUMAN_TEAMMATE"));
		return opinions;
	end

	-- At war with us
	if pFirstTeam:IsAtWar(eOtherTeam) then
		table.insert(opinions, L("TXT_KEY_DIPLO_AT_WAR"));
		return opinions;
	end

	-- Appears Friendly
	if iVisibleApproach == MajorCivApproachTypes.MAJOR_CIV_APPROACH_FRIENDLY then
		table.insert(opinions, L("TXT_KEY_DIPLO_FRIENDLY"));
		return opinions;
	end

	-- Appears Afraid
	if iVisibleApproach == MajorCivApproachTypes.MAJOR_CIV_APPROACH_AFRAID then
		table.insert(opinions, L("TXT_KEY_DIPLO_AFRAID"));
		return opinions;
	end

	-- Appears Guarded
	if iVisibleApproach == MajorCivApproachTypes.MAJOR_CIV_APPROACH_GUARDED then
		table.insert(opinions, L("TXT_KEY_DIPLO_GUARDED"));
		return opinions;
	end

	-- Appears Hostile
	if iVisibleApproach == MajorCivApproachTypes.MAJOR_CIV_APPROACH_HOSTILE then
		table.insert(opinions, L("TXT_KEY_DIPLO_HOSTILE"));
		return opinions;
	end

	-- Appears Neutral, opinions deliberately hidden
	if Game.IsHideOpinionTable() then
		if pOtherPlayer:IsActHostileTowardsHuman(eFirstPlayer) then
			table.insert(opinions, L("TXT_KEY_DIPLO_NEUTRAL_HOSTILE"));
		elseif pOtherTeam:GetTurnsSinceMeetingTeam(eFirstTeam) ~= 0 then
			table.insert(opinions, L("TXT_KEY_DIPLO_NEUTRAL_FRIENDLY"));
		end
		if next(opinions) then
			return opinions;
		end
	end

	-- Appears Neutral, no opinions
	table.insert(opinions, L("TXT_KEY_DIPLO_DEFAULT_STATUS"));
	return opinions;
end

-- Get opinions from first player with all other major civs
function getPlayerOpinionsWithAll(firstPlayer)
	local result = {};
	local pFirstPlayer = Players[firstPlayer];
	
	-- Check if first player is valid
	if not pFirstPlayer or not pFirstPlayer:IsAlive() then
		return result;
	end
	
	-- Iterate through all players
	for iPlayerLoop = 0, GameDefines.MAX_MAJOR_CIVS - 1, 1 do
		local pOtherPlayer = Players[iPlayerLoop];
		
		-- Skip if it's the same player or not a major civ
		if iPlayerLoop ~= firstPlayer and pOtherPlayer and pOtherPlayer:IsAlive() and not pOtherPlayer:IsMinorCiv() and not pOtherPlayer:IsBarbarian() then
			-- Get opinions from first player to this player
			result[tostring(iPlayerLoop)] = getPlayerOpinions(firstPlayer, iPlayerLoop);
		end
	end
	
	return result;
end

-- Legacy function for backwards compatibility (gets mutual opinions between two players)
function getPlayerOpinions(firstPlayer, secondPlayer)
	return {GetOpinions(firstPlayer, secondPlayer), GetOpinions(secondPlayer, firstPlayer)};
end

-- Determine which function to call based on arguments
if secondPlayer then
	return getPlayerOpinions(firstPlayer, secondPlayer);
else
	return getPlayerOpinionsWithAll(firstPlayer);
end