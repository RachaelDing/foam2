// Test with: foam.u2.ControllerMode.model_.javaSource();

foam.CLASS({
  refines: 'foam.core.EnumModel',

  methods: [
    function outputJava(o) {
      console.log('--------------')
      console.log('HERE')
    }
  ],

  templates: [
    {
      name: 'javaSource',
      template: `
// Generated by FOAM, do not modify.

package <%= this.package %>;
<%
var labelForValue = function(value) {
  if (this.androidResource) {
    return this.androidResource + "." + this.name + "_" + value.definition.name;
  } else {
    return '"' + value.definition.label + '"';
  }
}

%>
public enum <%= this.name %> {
<%
  for ( var i = 0 ; i < this.values.length ; i++ ) {
    var value = this.values[i];
    if ( value.javaSource ) { value.javaSource(out); }
    else {
%>  <%= value.name %>(<%= i %>, <%= value.definition.ordinal %>, <%= labelForValue(value) %>) <%
    }
    if ( i == this.values.length - 1 ) {%>;<%}
    else {%>,<%}
  }
%>

  private final int index_;
  private final int value_;
  private final String label_;
  <%= this.name %>(int index, int value, String label) {
    index_ = index;
    label_ = label;
    value_ = value;
  }

  public int getValue() { return value_; }
  public int getIndex() { return index_; }
  public String getLabel() { return label_; }

  public static <%= this.name %> forOrdinal(int ordinal) {
    switch (ordinal) {
<% for (var i = 0, value; value = this.values[i]; i++) { %>
      case <%= i %>: return <%= this.name %>.<%= value.name %>;
<% } %>
    }
    return null;
  }

  public static <%= this.name %> forIndex(int index) {
    switch (index) {
<% for (var i = 0, value; value = this.values[i]; i++) { %>
      case <%= i %>: return <%= this.name %>.<%= value.name %>;
<% } %>
    }
    return null;
  }

  public static <%= this.name %> forValue(int value) {
    for (<%= this.name %> e : <%= this.name %>.values()) {
      if (value == e.getValue()) {
        return e;
      }
    }
    return null;
  }

  public static String[] labels() {
    return new String[] {
<% for (var i = 0, value; value = this.values[i]; i++) { %>
      <%= labelForValue(value) %>,
<% } %>
    };
  }
}
      `
    }
  ]
})
