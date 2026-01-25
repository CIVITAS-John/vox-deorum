-- Get World Congress / United Nations info for AI accessibility
-- Returns proposals, votes, resolutions
-- Addresses World Congress gap identified in Issue #469

local pPlayer = Players[playerID]
if not pPlayer then
  return nil
end

-- Get the active league
local pLeague = nil
for iLeague = 0, GameDefines.MAX_LEAGUES - 1 do
  local tempLeague = Game.GetLeague(iLeague)
  if tempLeague and tempLeague:IsInSession() or tempLeague:CanStartSession() then
    pLeague = tempLeague
    break
  end
end

if not pLeague then
  return { Active = false, Message = "No World Congress or United Nations exists yet" }
end

local result = {
  Active = true,

  -- Basic info
  LeagueName = pLeague:GetName(),
  IsUnitedNations = Game.IsUnitedNationsActive(),
  HostCiv = Players[pLeague:GetHostMember()] and
            Players[pLeague:GetHostMember()]:GetCivilizationShortDescription() or "Unknown",

  -- Session status
  InSession = pLeague:IsInSession(),
  TurnsUntilSession = pLeague:GetTurnsUntilSession(),
  IsSpecialSession = pLeague:IsInSpecialSession(),

  -- Our voting power
  OurVotes = pLeague:CalculateStartingVotesForMember(playerID),
  ProposalsAvailable = pLeague:GetRemainingProposalsForMember(playerID),
  VotesRemaining = pLeague:GetRemainingVotesForMember(playerID),

  -- Diplomatic victory
  DiploVictoryEnabled = Game.IsVictoryValid(GameInfoTypes.VICTORY_DIPLOMATIC),
  VotesNeededForVictory = Game.GetVotesNeededForDiploVictory(),

  -- Active resolutions (in effect now)
  ActiveResolutions = {},

  -- Current proposals being voted on
  CurrentProposals = {},

  -- Available to propose
  ProposableResolutions = {},

  -- Members
  Members = {},
}

-- Get active resolutions
for i, resolution in ipairs(pLeague:GetActiveResolutions()) do
  local resInfo = GameInfo.Resolutions[resolution.Type]
  if resInfo then
    table.insert(result.ActiveResolutions, {
      Name = Locale.ConvertTextKey(resInfo.Description),
      ProposedBy = Players[resolution.ProposerChoice] and
                   Players[resolution.ProposerChoice]:GetCivilizationShortDescription() or "Unknown",
    })
  end
end

-- Get current proposals (if in session)
if pLeague:IsInSession() then
  for i, proposal in ipairs(pLeague:GetEnactProposals()) do
    local resInfo = GameInfo.Resolutions[proposal.Type]
    if resInfo then
      table.insert(result.CurrentProposals, {
        Name = Locale.ConvertTextKey(resInfo.Description),
        Type = "Enact",
        ProposedBy = Players[proposal.ProposerChoice] and
                     Players[proposal.ProposerChoice]:GetCivilizationShortDescription() or "Unknown",
      })
    end
  end

  for i, proposal in ipairs(pLeague:GetRepealProposals()) do
    local resInfo = GameInfo.Resolutions[proposal.Type]
    if resInfo then
      table.insert(result.CurrentProposals, {
        Name = Locale.ConvertTextKey(resInfo.Description),
        Type = "Repeal",
        ProposedBy = Players[proposal.ProposerChoice] and
                     Players[proposal.ProposerChoice]:GetCivilizationShortDescription() or "Unknown",
      })
    end
  end
end

-- Get proposable resolutions
for resolution in GameInfo.Resolutions() do
  local canPropose = pLeague:CanProposeEnact(resolution.ID, playerID, -1)
  if canPropose or pLeague:IsProposed(resolution.ID, playerID, true) then
    table.insert(result.ProposableResolutions, {
      Name = Locale.ConvertTextKey(resolution.Description),
      CanPropose = canPropose,
    })
  end
end

-- Get members
for iPlayer = 0, GameDefines.MAX_MAJOR_CIVS - 1 do
  local pLoopPlayer = Players[iPlayer]
  if pLoopPlayer and pLoopPlayer:IsAlive() and pLeague:IsMember(iPlayer) then
    table.insert(result.Members, {
      CivName = pLoopPlayer:GetCivilizationShortDescription(),
      Votes = pLeague:CalculateStartingVotesForMember(iPlayer),
      IsHost = pLeague:GetHostMember() == iPlayer,
    })
  end
end

return result
