import { Filters, Operator } from '../src/criteria';

describe('Filters', () => {
  describe('fromValues', () => {
    it('should create filters from array of maps', () => {
      const filterMaps = [
        new Map([
          ['field', 'status'],
          ['operator', Operator.EQUAL],
          ['value', 'active']
        ]),
        new Map([
          ['field', 'age'],
          ['operator', Operator.GT],
          ['value', '18']
        ])
      ];

      const filters = Filters.fromValues(filterMaps);

      expect(filters.filters).toHaveLength(2);
      expect(filters.filters[0].field.value).toBe('status');
      expect(filters.filters[0].operator.value).toBe(Operator.EQUAL);
      expect(filters.filters[0].value.value).toBe('active');
    });

    it('should create empty filters from empty array', () => {
      const filters = Filters.fromValues([]);
      
      expect(filters.filters).toHaveLength(0);
    });
  });

  describe('none', () => {
    it('should create empty filters', () => {
      const filters = Filters.none();
      
      expect(filters.filters).toHaveLength(0);
    });
  });
});