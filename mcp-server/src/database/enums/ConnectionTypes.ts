// Manually from TradeConnectionTypes
export const TradeConnectionTypes: Record<number, string> = {
  '-1': 'None',
  0: 'Food',
  1: 'Production',
  2: 'Gold',
  3: 'Science',
  4: 'Culture',
  5: 'Faith',
  6: 'Tourism',
  7: 'GoldenAgePoints',
  8: 'GreatGeneralPoints',
  9: 'GreatAdmiralPoints',
  10: 'Population',
  11: 'CultureLocal',
  12: 'JfdHealth',
  13: 'JfdDisease',
  14: 'JfdCrime',
  15: 'JfdLoyalty',
  16: 'JfdSovereignty'
};

/*
	// TradeConnectionTypes
	EnumStart(L, "TradeConnectionTypes");
	RegisterEnum(TRADE_CONNECTION_INTERNATIONAL);
	RegisterEnum(TRADE_CONNECTION_FOOD);
	RegisterEnum(TRADE_CONNECTION_PRODUCTION);
#if defined(MOD_TRADE_WONDER_RESOURCE_ROUTES)
	RegisterEnum(TRADE_CONNECTION_WONDER_RESOURCE);
#endif
#if defined(MOD_BALANCE_CORE_GOLD_INTERNAL_TRADE_ROUTES)
	RegisterEnum(TRADE_CONNECTION_GOLD_INTERNAL);
#endif
	RegisterEnum(NUM_TRADE_CONNECTION_TYPES);
	EnumEnd(L);
*/