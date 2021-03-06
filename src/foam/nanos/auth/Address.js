/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.nanos.auth',
  name: 'Address',

  documentation: 'The base model for the postal address.',

  implements: [
    {
      path: 'foam.mlang.Expressions',
      flags: ['js'],
    },
  ],

  requires: [
    'foam.nanos.auth.Region'
  ],

  properties: [
    {
      class: 'Boolean',
      name: 'structured',
      value: true,
      documentation: `Determines whether the address is shown in the following structure: 
        Street Number, Street Name, Suite Number. For an unstructured address field, 
        use address1 and/or address2.
      `,
      hidden: true
    },
    {
      class: 'String',
      name: 'address1',
      width: 70,
      displayWidth: 50,
      documentation: 'An unstructured field for the main postal address.',
      expression: function(structured, streetNumber, streetName) {
        return structured ? streetNumber + ' ' + streetName : '';
      },
      validationPredicates: [
        {
          args: ['structured', 'address1'],
          predicateFactory: function(e) {
            return e.OR(
              e.EQ(foam.nanos.auth.Address.STRUCTURED, true),
              e.GTE(foam.mlang.StringLength.create({
                arg1: foam.nanos.auth.Address.ADDRESS1
              }), 1)
            );
          },
          errorString: 'Invalid value for address 1.'
        }
      ],
      hidden: true
    },
    {
      class: 'String',
      name: 'address2',
      width: 70,
      displayWidth: 50,
      documentation: 'An unstructured field for the sub postal address.',
      hidden: true
    },
    {
      class: 'Reference',
      targetDAOKey: 'countryDAO',
      name: 'countryId',
      label: 'Country',
      of: 'foam.nanos.auth.Country',
      documentation: `A foreign key into the CountryDAO which represents the country.`,
      required: true,
      gridColumns: 6,
      validateObj: function(countryId) {
        if ( typeof countryId !== 'string' || countryId.length === 0 ) {
          return 'Country required.';
        }
      },
      postSet: function(oldValue, newValue) {
        if ( oldValue !== newValue ) {
          this.regionId = undefined;
        }
      },
      view: function(_, X) {
        return {
          class: 'foam.u2.view.RichChoiceView',
          search: true,
          sections: [
            {
              heading: 'Countries',
              dao: X.countryDAO
            }
          ]
        };
      }
    },
    {
      class: 'Reference',
      targetDAOKey: 'regionDAO',
      name: 'regionId',
      label: 'Region',
      of: 'foam.nanos.auth.Region',
      documentation: `A foreign key into the RegionDAO which represents
        the region of the country.`,
      gridColumns: 6,
      view: function(_, X) {
        var choices = X.data.slot(function(countryId) {
          return X.regionDAO.where(X.data.EQ(X.data.Region.COUNTRY_ID, countryId || ""));
        });
        return foam.u2.view.ChoiceView.create({
          objToChoice: function(region) {
            return [region.id, region.name];
          },
          dao$: choices
        });
      },
      required: true,
      validateObj: function(regionId, countryId) {
        // If the country hasn't been selected yet, don't show this error.
        if ( countryId == null ) return;
        if ( typeof regionId !== 'string' || regionId.length === 0 ) {
          switch ( countryId ) {
            case 'CA':
              return 'Province required.';
            case 'US':
              return 'State required.';
            default:
              return 'Region required.';
          }
        }
      }
    },
    {
      class: 'String',
      name: 'suite',
      documentation: 'The structured field for the suite number of the postal address.',
      gridColumns: 3,
      width: 16
    },
    {
      // TODO: Remove structured, street number, and street name. This should be a view concern
      // and not baked into the model.
      class: 'String',
      name: 'streetNumber',
      label: 'Street No.',
      width: 16,
      documentation: 'The structured field for the street number of the postal address.',
      gridColumns: 3,
      validationPredicates: [
        {
          args: ['structured', 'streetNumber'],
          predicateFactory: function(e) {
            return e.OR(
              e.EQ(foam.nanos.auth.Address.STRUCTURED, false),
              e.GTE(foam.mlang.StringLength.create({
                arg1: foam.nanos.auth.Address.STREET_NUMBER
              }), 1)
            );
          },
          errorString: 'Invalid street number.'
        }
      ]
    },
    {
      class: 'String',
      name: 'streetName',
      width: 70,
      documentation: 'The structured field for the street name of the postal address.',
      gridColumns: 6,
      validationPredicates: [
        {
          args: ['structured', 'streetName'],
          predicateFactory: function(e) {
            return e.OR(
              e.EQ(foam.nanos.auth.Address.STRUCTURED, false),
              e.REG_EXP(foam.nanos.auth.Address.STREET_NAME, /^\s*.+\s*$/)
            );
          },
          errorString: 'Invalid street name.'
        }
      ]
    },
    {
      class: 'String',
      name: 'city',
      documentation: 'The city of the postal address.',
      required: true,
      minLength: 1,
      gridColumns: 6,
    },
    {
      class: 'String',
      name: 'postalCode',
      documentation: 'The postal code of the postal address.',
      preSet: function(oldValue, newValue) {
        return newValue.toUpperCase();
      },
      gridColumns: 6,
      validationPredicates: [
        {
          args: ['postalCode', 'countryId'],
          predicateFactory: function(e) {
            return e.OR(
              e.NEQ(foam.nanos.auth.Address.COUNTRY_ID, 'CA'),
              e.REG_EXP(
                foam.nanos.auth.Address.POSTAL_CODE,
                /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d$/i)
            );
          },
          errorString: 'Invalid postal code'
        },
        {
          args: ['postalCode', 'countryId'],
          predicateFactory: function(e) {
            return e.OR(
              e.NEQ(foam.nanos.auth.Address.COUNTRY_ID, 'US'),
              e.REG_EXP(
                foam.nanos.auth.Address.POSTAL_CODE,
                /^^\d{5}(?:[-\s]\d{4})?$/i)
            );
          },
          errorString: 'Invalid zip code'
        },
        {
          args: ['postalCode', 'countryId'],
          predicateFactory: function(e) {
            return e.OR(
              e.NEQ(foam.nanos.auth.Address.COUNTRY_ID, 'IN'),
              e.REG_EXP(
                foam.nanos.auth.Address.POSTAL_CODE,
                /^^\d{6}(?:[-\s]\d{4})?$/i)
            );
          },
          errorString: 'Invalid zip code'
        }
      ],
      javaSetter:
        `postalCode_ = val.toUpperCase();
        postalCodeIsSet_ = true;`
    },
    {
      class: 'Double',
      name: 'latitude',
      documentation: 'The latitude of the postal address location.',
      hidden: true
    },
    {
      class: 'Double',
      name: 'longitude',
      documentation: 'The longitude of the postal address location.',
      hidden: true
    },
    {
      class: 'Enum',
      name: 'propertyType',
      of: 'foam.nanos.auth.PropertyType',
      documentation: 'Defines property type of address.'
    }
  ],

  methods: [
    {
      name: 'toSummary',
      type: 'String',
      code: function() {
        var rtn = this.getShortAddress();
        rtn += ', ';
        rtn += this.city;
        rtn += ', ';
        rtn += this.regionId;
        rtn += ', ';
        rtn += this.countryId;
        rtn += ', ';
        rtn += this.postalCode;
        return rtn === ', , , , ' ? '' : rtn;
      },
      javaCode: `
      StringBuilder sb = new StringBuilder();
      sb.append(getShortAddress());
      sb.append(", ");
      sb.append(this.getCity());
      sb.append(", ");
      sb.append(this.getRegionId());
      sb.append(", ");
      sb.append(this.getCountryId());
      sb.append(", ");
      sb.append(this.getPostalCode());
      String rtn = sb.toString();
      return rtn.equals(", , , , ") ? "" : rtn;
      `
    },
    {
      name: 'getShortAddress',
      type: 'String',
      code: function() {
        var rtn = '';
        if ( this.structured ) {
          rtn += this.suite;
          rtn += (this.suite ? '-' : '');
          rtn += this.streetNumber;
          rtn += ' ';
          rtn += this.streetName;
        } else {
          rtn += this.address1;
          rtn += ' ';
          rtn += this.address2;
        }
        return rtn.trim();
      },
      javaCode: `
      StringBuilder sb = new StringBuilder();
      if ( this.getStructured() ) {
        if ( this.getSuite() != null ) {
          sb.append(this.getSuite());
          sb.append("-");
        }
        sb.append(this.getStreetNumber());
        sb.append(" ");
        sb.append(this.getStreetName());
      } else {
        sb.append(this.getAddress1());
        sb.append(" ");
        sb.append(this.getAddress2());
      }
      return sb.toString().trim();
      `
    },
    {
      name: 'getAddress',
      type: 'String',
      code: function() {
        return this.getShortAddress();
      },
      javaCode: `
      return getShortAddress();
     `
    }
  ]
});
