// Manually from CaptureTypes
export const CaptureTypes: Record<number, string> = {
  '-1': 'None',
  0: 'Combat',
  1: 'Combat',
  2: 'Conversion',
  3: 'Conversion',
  4: 'Conversion'
};

/*
6. **Capture Type** (`int`): An integer indicating the type/context of capture:
   - `0` = Standard combat capture/kill
   - `1` = Capture through combat mechanics using capture definition
   - `2` = Trait-based conversion/capture
   - `3` = Trait-based barbarian conversion with gold reward
   - `4` = Religious belief-based barbarian conversion
*/