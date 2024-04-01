# Adding Excitement to &lt;select&gt;

Transform any &lt;select&gt; element into a searchable dropdown.

View the [Live example](https://droverbuild.github.io/BootstrapDropdownSelect/).

## Features:
- Use a pre-rendered &lt;select&gt; tag or fetch from server via AJAX with customizable search params
- Search is debounced before making AJAX request
- Process data retrieved from AJAX call before it is rendered into the dropdown 
- Supports disabled options and optgroup
- Natural keyboard navigation and accessibility
- Works perfectly with forms
- Customize what is rendered for each option
- Add options to existing or new option groups if needed. 

## Requirements: 
- Bootstrap 5
- FontAwesome 6

## Usage

Add the [CSS file](index.css) to the HTML head after the Bootstrap and FontAwesome CSS links. Add 
[bootstrapDropdownSelect.js](bootstrapDropdownSelect.js) at the end of the body element after the Bootstrap JS.

### Data Source: AJAX
In your HTML, add an empty &lt;select&gt; element. Any accompanying labels will automatically be reassigned to the 
search input element that is rendered when building the dropdown. 

```html
<div class="mb-3">
  <label for="ddSel" class="form-label">User</label>
  <select id="ddSel" name="user"></select>
</div>
```

After [bootstrapDropdownSelect.js](bootstrapDropdownSelect.js) is loaded in, construct a new BootstrapDropdownSelect 
object and pass in the proper options. Continue below to the BootstrapDropdownSelect options reference for details about 
the options object.

```js
const options = {
  placeholder: 'Select User',
  url: 'https://api.slingacademy.com/v1/sample-data/users',
  queryParams: (searchQuery, previousParams, previousRequestData) => {
    const limit = 20;
    let params = previousParams ? previousParams : new URLSearchParams();

    // add limit to previous offset or set to 0 if no previousParams
    let offset;
    if (!previousParams || searchQuery !== previousParams.get('search')) {
      // set offset to 0 if there was no previous request or if there's a new search query
      offset = 0;
    } else {
      // otherwise, add limit to the previous offset to get this offset
      offset = parseInt(params.get('offset')) + limit
    }

    params.set('offset', offset);
    params.set('limit', limit);

    if (!searchQuery || searchQuery.trim().length === 0) {
      params.delete('search');
    } else {
      params.set('search', searchQuery);
    }

    return params;
  },
  processData: (data, reqParams) => {
    const processed = data.users.map(u => {
      return {
        value: `${u.id}`, // important to convert this value to string or value identification will not work
        label: `${u.first_name} ${u.last_name}`,
        htmlLabel: `<div class="fw-bold">${u.first_name} ${u.last_name}</div><div class="text-secondary">${u.city}, ${u.country}</div>`
      };
    });

    return {
      data: processed,
      hasMore: data.offset + data.limit < data.total_users,
      optGroup: `Page ${data.offset / data.limit + 1}`
    };
  }
};
const dropdown2 = new BootstrapDropdownSelect(document.getElementById('ddSel'), options);
```

The first parameter of the constructor should be the &lt;select&gt; element that will be transformed into a dropdown.
This is the source element, and will be hidden during construction of the dropdown.

A dropdown with an option already selected upon initialization can be rendered by adding an option into the source 
&lt;select&gt; element as follows:

```html
<select id="ddSel" name="users">
  <option value="3">Brittany Bradford</option> <!-- Will become the selected option upon initialization -->
</select>
```

### Data Source: &lt;select&gt;

Render your options as usual in a &lt;select&gt; element:

```html
<div class="mb-3">
  <label for="ddSel1" class="form-label">Multi-Select element transformed to Dropdown Select</label>
  <select id="ddSel1" name="users_1" class="form-select" multiple>
    <option value="user1">User 1</option>
    <optgroup label="Users">
      <option value="user2">User 2</option>
    </optgroup>
    <optgroup label="terminated">
      <option value="user3">User 3</option>
      <option value="user4">User 4</option>
      <option value="user5">User 5</option>
      <option value="user6">User 6</option>
      <option value="user7">User 7</option>
      <option value="user8">User 8</option>
      <option value="user9">User 9</option>
      <option value="user10">User 10</option>
      <option disabled value="user11">User 11</option>
      <option value="user12">User 12</option>
    </optgroup>
  </select>
</div>
```

After [bootstrapDropdownSelect.js](bootstrapDropdownSelect.js) is loaded in, construct a new BootstrapDropdownSelect
object and pass in the proper options. 

```js
const dropdown = new BootstrapDropdownSelect(document.getElementById('ddSel1'), {placeholder: 'Search User'});
```

## Options

### `options.placeholder`

- **Type**: `string`
- **Required**: No

The placeholder for the rendered input element used for search.

### `options.url`

- **Type**: `string`
- **Required**: No

The endpoint for the AJAX call to fetch the available options for the select. When the dropdown is opened or when the 
end of a page is reached, a GET request is made to this URL with the configured query string. At this time, the only 
configurable part of the request is the URL and query string. This component has no support for POST requests.

If `url` has no value, the dropdown will be rendered from the children of the &lt;select&gt; element at the time of
the constructor call.

### `options.multiple`

- **Type**: `boolean`
- **Required**: No

Enables multiple selections in the dropdown. Selected items show up as badges in the form-control container, with a 
clickable `fa-xmark` icon to deselect the selected option. Pressing Backspace in the search input also removes the last
item that is selected.

If the source &lt;select&gt; element has the `multiple` attribute, that takes precedence over the value of this option.

### `options.queryParams`

- **Type**: `function(searchQuery, previousUrlSearchParams, previousRequestData): URLSearchParams`
- **Required**: Required when `options.url` is provided

A function to configure the URLSearchParams object to be used for the next request. This function provides the 
URLSearchParams that you built in the previous request, if there was one, for you to build the query parameters for the
next request. 

On the first request, build a new object of URLSearchParams, add your pagination parameters (such as `offset` and 
`limit`), and return.

On subsequent requests, if `searchQuery` and the search query value in `previousUrlSearchParams` are different, you 
should reset the pagination parameter that you use. If they are the same, simply take `previousUrlSearchParams`, 
increment your pagination parameter, and return the same object.

| Parameter Name            | Type              | Description                                                                                                        |
|---------------------------|-------------------|--------------------------------------------------------------------------------------------------------------------|
| `searchQuery`             | `string`          | Value of the search input.                                                                                         |
| `previousUrlSearchParams` | `URLSearchParams` | The same URLSearchParams object used to make the previous request, if any. Will be undefined on the first request. |
| `previousRequestData`     | `any`             | The data object returned from the previous request, if any. Will be undefined on the first request.                |

### `options.processData`

- **Type**: `function(data, reqParams): ProcessedData`
- **Required**: Required when `options.url` is provided

A function to transform the response of the AJAX request into the shape required to render the new options in the 
dropdown. Also includes metadata about whether a new page should be loaded and if the data should be added to a new or
existing option group.

| Parameter Name       | Type              | Description                                                                                 |
|----------------------|-------------------|---------------------------------------------------------------------------------------------|
| `data`               | `any`             | Object of the AJAX response, deserialized from JSON.                                        |
| `requestQueryParams` | `URLSearchParams` | The same URLSearchParams object built in `options.queryParams` before the request was made. |

#### Return Object Properties (`ProcessedData`)
| Name       | Type      | Required | Description                                                                                                                                                            |
|------------|-----------|----------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `data`     | `Object`  | Yes      | Data that will be rendered into the dropdown. Read Properties of `data` for object shape.                                                                              |
| `hasMore`  | `boolean` | Yes      | Set to true if the dropdown should load a new page when the end of the scrollview is reached.                                                                          |
| `optGroup` | `string`  | No       | If this is set, the options in `data` will be rendered under this given option group. If it doesn't exist, a new option group is created with this value as the label. |

#### Properties of `data`
| Name        | Type      | Required | Description                                                                                                                                                                                                 |
|-------------|-----------|----------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `label`     | `string`  | Yes      | Display label of the option. Rendered in the dropdown and in the search box and multi-select tags when selected.                                                                                            |
| `htmlLabel` | `string`  | No       | If this is set, the dropdown renders this as HTML for each option. The value of `label` will still be used in the search box when the option is checked. **Note**: Not supported for DOM data sources.      |
| `value`     | `string`  | Yes      | The value of the option that is submitted through FormData. It is important to convert this value to string (if, for instance, your identifier is a number). Otherwise, value identification will not work. |
| `disabled`  | `boolean` | No       | Whether or not the option is disabled.                                                                                                                                                                      |
