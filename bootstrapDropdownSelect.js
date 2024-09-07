/**
 * @typedef {Object} OptionItemChild
 * @property {string} label - The text content displayed to user.
 * @property {string?} htmlLabel - HTML content rendered in the dropdown.
 * @property {string} value - The value that is sent through the form data. Leave undefined if an optgroup.
 * @property {boolean?} disabled - Disables the option. Leave undefined if an optgroup.
 */

/**
 * @typedef {Object} OptionItem
 * @property {string} label - The text content displayed to user.
 * @property {string?} htmlLabel - HTML content rendered in the dropdown.
 * @property {string?} value - The value that is sent through the form data. Leave undefined if an optgroup.
 * @property {boolean?} disabled - Disables the option. Leave undefined if an optgroup.
 * @property {OptionItemChild[]?} children - Children options if this is an optgroup.
 */

/**
 * @typedef {function(string?, URLSearchParams?, any?): URLSearchParams} BuildQueryParamsFunction
 */

/**
 * @typedef {Object} ProcessedData
 * @property {OptionItemChild[]} data
 * @property {boolean} hasMore
 * @property {string?} optGroup
 */

/**
 * @typedef {function(any, URLSearchParams): ProcessedData} ProcessDataFunction
 */

/**
 * @typedef {Object} BootstrapDropdownSelectOptions
 * @property {string?} placeholder
 * @property {string?} url
 * @property {boolean?} multiple
 * @property {BuildQueryParamsFunction?} queryParams
 * @property {ProcessDataFunction?} processData
 */

class BootstrapDropdownSelect {
  /**
   *
   * @param {HTMLSelectElement} element
   * @param {BootstrapDropdownSelectOptions} options
   */
  constructor(element, options) {
    this.src = element;
    this.multiple = this.src.hasAttribute('multiple') || options.multiple;
    this.options = options;

    // need a whitespace placeholder to get :placeholder-shown working correctly
    if (!this.options.placeholder || this.options.placeholder.length === 0) this.options.placeholder = ' ';

    // New element that is rendered, container for an input and dropdown div.
    this.trg = this.formGroupTemplate(this.options.placeholder, this.multiple);

    /**
     * The input controller. Displays the dropdown when in focus. User enters a search query in this control to search
     * users. Shows the label of the selected option when one is chosen
     * @type {HTMLInputElement}
     */
    this.input = this.trg.querySelector('.bsddsel-input');

    /**
     * @type {HTMLDivElement}
     */
    this.dropdown = this.trg.querySelector('.bsddsel-dropdown');

    /**
     * Spinner element, animated through CSS. This element will be observed for scrolling and if it comes into view,
     * triggers the next page load.
     * @type {HTMLDivElement | null}
     */
    this.spinner = null;

    // Flag for scroll observer. If this is true, the scroll observer will trigger the next page to be loaded when the
    // spinner is visible.
    this.loadNextTriggered = false;
    this.debounceTimer = null;

    /**
     *
     * @type {string | null}
     */
    this.searchQuery = null;

    /**
     *
     * @type {URLSearchParams | null}
     */
    this.previousParams = null;

    /**
     *
     * @type {any}
     */
    this.previousRequestData = null;

    // A data object looks like: { id: 'identifier', label: 'Friendly Name'};
    // For an optgroup: { label: 'Friendly Name', children: [ {id: ..., label: ... } ] }.
    // THIS IS NOT USED FOR AJAX DATA
    /**
     *
     * @type {OptionItem[]}
     */
    this.data = [];

    if (!options.url) {
      // if no url provided, our data source is the options from the <select> tag
      this.loadDataFromSrc();
      this.renderOptions();
    }


    this.loadSelectedOptionFromSrc();

    this.src.insertAdjacentElement('afterend', this.trg);
    this.src.style.display = 'none';
    this.registerEvents();
    this.reassignLabels();

    this.scrollObserver = new IntersectionObserver((entries) => {
      // do nothing if spinner is not visible or loading the next page has been triggered (ie this scroll observer was
      // fired again)
      if (entries.length === 0 || entries.every(e => !e.isIntersecting) || this.loadNextTriggered) return;
      this.loadNextPage();
    }, {
      root: this.dropdown[0],
      threshold: 0.1
    });

    if (options.url) {
      // spinner should always be in place if we plan to load more. if spinner is visible (user scrolled down far
      // enough), a new page should be loading
      this.addSpinner();
    }
  }

  /**
   *
   * @param {string} placeholder
   * @param {boolean} isMultiple
   * @returns {HTMLDivElement}
   */
  formGroupTemplate(placeholder, isMultiple) {
    const el = document.createElement('div');
    el.classList.add('bsddsel-form-group');
    if (!isMultiple) el.classList.add('single-select');
    el.innerHTML = `<div class="form-control">
        <input type="text" class="bsddsel-input" placeholder="${placeholder}" autocomplete="off" autocorrect="off">
        <span class="fa-solid fa-xmark form-control-clear" title="Clear current selection"></span>
        <span class="bsddsel-dropdown-indicator fa-solid fa-chevron-down" tabindex="-1"></span>
        <span class="bsddsel-dropdown-indicator fa-solid fa-magnifying-glass" tabindex="-1"></span>
      </div>
      <div class="bsddsel-dropdown"></div>`;
    return el;
  }

  /**
   *
   * @param {OptionItemChild} option
   * @returns {HTMLDivElement}
   */
  renderSingleOption(option) {
    const el = document.createElement('div');
    el.role = 'option';
    el.classList.add('bsddsel-group-option');
    el.dataset.label = option.label;
    el.dataset.value = option.value;

    const selectedOption = Array.from(this.src.selectedOptions).find(s => s.value === option.value);
    if (selectedOption) {
      el.classList.add('selected');
    }

    if (option.htmlLabel) {
      el.innerHTML = option.htmlLabel;
    } else {
      el.innerText = option.label;
    }
    if (option.disabled) {
      el.ariaDisabled = 'disabled';
      el.setAttribute('disabled', 'disabled');
    } else {
      el.tabIndex = 0;
    }

    return el;
  }

  /**
   *
   * @param {OptionItem} optgroup
   * @returns {HTMLDivElement}
   */
  renderOptionGroup(optgroup) {
    const el = document.createElement('div');
    el.classList.add('bsddsel-group');
    el.dataset.group = optgroup.label;

    if (optgroup.label && typeof optgroup.label === 'string' && optgroup.label.trim().length > 0) {
      const header = document.createElement('div');
      header.classList.add('bsddsel-group-header');
      header.innerHTML = optgroup.label;
      el.appendChild(header);
    }

    for (const child of optgroup.children) {
      el.appendChild(this.renderSingleOption(child));
    }

    return el;
  }

  /**
   * Constructs a new multiselect tag element and adds it to the DOM before the search input element.
   * @param {string} label
   * @param {string} value
   */
  renderMultiselectTag(label, value) {
    const el = document.createElement('span');
    el.classList.add('multiselect-tag');
    el.dataset.value = value;
    el.tabIndex = -1;
    el.innerHTML = `<span class="fa-solid fa-xmark"></span>${label}`;
    this.input.insertAdjacentElement('beforebegin', el);
    this.input.placeholder = '';
  }

  /**
   * Renders the given data array as options added to the current data set. If optGroup is defined, the options will
   * be rendered in the given opt group.
   * @param {OptionItemChild[]} data
   * @param {string?} optGroup
   */
  renderAddedOptions(data, optGroup) {
    let receivingElement = this.dropdown;

    if (optGroup) {
      const group = this.dropdown.querySelector(`.bsddsel-group[data-group='${optGroup}']`);
      if (!group) {
        receivingElement.appendChild(this.renderOptionGroup({label: optGroup, children: data}));
        return;
      }
      receivingElement = group;
    }

    for (const option of data) {
      const newOption = this.renderSingleOption(option);
      if (this.multiple && Array.from(this.src.selectedOptions).find(o => o.value)) {
        newOption.classList.add('selected');
      }
      receivingElement.appendChild(newOption);
    }
  }

  /**
   * Renders the dropdown from the select element. Only called when the source is the select element, not AJAX.
   * @param {string?} searchQuery - renders items in the dropdown if the search query is defined.
   */
  renderOptions(searchQuery) {
    this.dropdown.innerHTML = '';
    let filteredData = this.data;

    if (searchQuery && searchQuery.trim().length > 0) {
      filteredData = this.filterData(searchQuery);
    }

    for (const option of filteredData) {
      this.dropdown.appendChild(option.children ? this.renderOptionGroup(option) : this.renderSingleOption(option));
    }
  }

  /**
   *
   * @param {string} searchQuery
   * @returns {OptionItem[]}
   */
  filterData(searchQuery) {
    const queryNormalized = searchQuery.toLowerCase().trim();
    /**
     * @type {OptionItem[]}
     */
    let filtered = [];
    for (const item of this.data) {
      if (!item.children) {
        if (item.label.toLowerCase().includes(queryNormalized)) {
          filtered.push(item);
        }
        continue;
      }

      /**
       * @type {OptionItemChild[]}
       */
      let filteredChildren = [];
      for (const child of item.children) {
        if (child.label.toLowerCase().includes(queryNormalized)) {
          filteredChildren.push(child);
        }
      }

      if (filteredChildren.length > 0) {
        filtered.push({...item, children: filteredChildren});
      }
    }

    return filtered;
  }

  debouncedSearchQueryChanged(s) {
    this.debounceTimer = null;
    this.searchQuery = s;
    this.dropdown.innerHTML = '';
    this.addSpinner();

    // reset pagination
    this.previousParams = null;
    this.previousRequestData = null;
  }

  async loadNextPage() {
    if (!this.options.url) {
      throw new Error('options.url must have a value');
    }

    if (!this.options.queryParams || typeof this.options.queryParams !== 'function') {
      throw new Error('options.queryParams is not a function');
    }

    if (!this.options.processData || typeof this.options.processData !== 'function') {
      throw new Error('options.processData is not a function');
    }

    this.previousParams = this.options.queryParams(this.searchQuery, this.previousParams, this.previousRequestData);
    const ajaxUrl = `${this.options.url}?${this.previousParams.toString()}`;
    try {
      const response = await fetch(ajaxUrl);
      this.previousRequestData = await response.json();
      const dataResult = this.options.processData(this.previousRequestData, this.previousParams);

      if (!Array.isArray(dataResult.data)) {
        throw new Error('dataResult.data must be an array');
      }

      this.removeSpinner();
      if (dataResult.data.length > 0) this.renderAddedOptions(dataResult.data, dataResult.optGroup);
      if (dataResult.hasMore) {
        this.addSpinner();
      }
    } catch (e) {
      this.removeSpinner();
      console.error(e);
    }
  }

  addSpinner() {
    const spinner = document.createElement('div');
    spinner.classList.add('lds-spinner');
    spinner.innerHTML = '<div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div>';
    this.dropdown.appendChild(spinner);
    this.scrollObserver.observe(spinner);
    this.spinner = spinner;
  }

  removeSpinner() {
    this.spinner?.remove();
    this.spinner = null;
  }

  closeDropdown() {
    this.trg.classList.remove('dropdown-open');
  }

  openDropdown() {
    this.trg.classList.add('dropdown-open');
  }

  dropdownIsOpen() {
    return this.trg.classList.contains('dropdown-open');
  }

  focusNextOption() {
    this.traverseFocus(1);
  }

  focusPreviousOption() {
    this.traverseFocus(-1);
  }

  /**
   * Moves focus up or down the children of this.trg that aren't disabled. If there is not an element in the select
   * dropdown that is currently in focus, the focus starts at the first element of the dropdown if amount is positive
   * or the bottom if amount is negative. If amount extends beyond the bounds of the items in the dropdown, the focus
   * continues from the other end of the list.
   * @param {number} amount Number of items to jump. If negative, focus goes up. If positive, focus goes down.
   */
  traverseFocus(amount) {
    this.openDropdown();

    const selectChoices = Array.from(this.trg.querySelectorAll('.bsddsel-group-option:not([disabled])'));

    if (selectChoices.length === 0) return;

    const active = document.activeElement;
    let nextIdx;
    if (active && selectChoices.includes(active)) {
      nextIdx = selectChoices.indexOf(active) + amount;
    } else {
      // start from 0 (if going forward) or -1 (if going backward)
      nextIdx = amount > 0 ? amount - 1 : amount;
    }
    nextIdx %= selectChoices.length;
    if (nextIdx < 0) nextIdx += selectChoices.length;
    selectChoices[nextIdx].focus();
  }

  /**
   * Reassigns all labels in the document that were associated with the original select element to the search input that
   * is rendered by attaching this class.
   */
  reassignLabels() {
    const srcId = this.src.id;
    if (!srcId || srcId.length === 0) return;
    const inputId = `${srcId}_search`;
    this.input.id = inputId;
    document.querySelectorAll(`label[for='${srcId}']`).forEach(l => l.htmlFor = inputId);
  }

  /**
   * Build the data model for this searchable dropdown select from the existing <select> tag.
   */
  loadDataFromSrc() {
    /**
     * @type {OptionItem[]}
     */
    const data = [];
    const children = Array.from(this.src.children);
    for (let child of children) {
      if (child.tagName === 'OPTION') {
        data.push({value: child.value, label: child.label, disabled: !!child.disabled});
      } else if (child.tagName === 'OPTGROUP') {
        const children = [];
        for (const optGroupChild of Array.from(child.children)) {
          children.push({
            value: optGroupChild.value,
            label: optGroupChild.label,
            disabled: !!optGroupChild.disabled
          });
        }
        data.push({label: child.label, children});
      }
    }

    this.data = data;
  }

  /**
   * If the <select> element has an option already selected when this dropdown is initialized, this will place the label
   * of the selected option into the search input to indicate the selected option.
   */
  loadSelectedOptionFromSrc() {
    const allSelected = Array.from(this.src.selectedOptions);
    if (this.multiple) {
      for (const option of allSelected) {
        this.renderMultiselectTag(option.label, option.value);
      }
      return;
    }
    const selected = Array.from(this.src.selectedOptions).find(o => o.selected);
    if (selected) {
      this.input.value = selected.label;
    }
  }

  /**
   * Sets the value in this.src and the value of the search box to the label of the given option. If this select is a
   * multi-select, the option is toggled on or off.
   * @param {HTMLDivElement} selectGroupOption
   */
  makeSelection(selectGroupOption) {
    if (selectGroupOption.hasAttribute('disabled')) {
      return;
    }
    const value = selectGroupOption.dataset.value;
    const label = selectGroupOption.dataset.label;

    if (
      this.options.url &&
      !this.src.querySelector(`option[value="${value}"]`)
    ) {
      // small performance enhancment -- prevent doing $src.find() if no options.url because the presence of options.url
      // implies that our data comes from ajax, so src probably won't have the value we need. the lack of options.url
      // implies our data comes from src itself so src should definitely have it and there's no need to add the option
      const option = document.createElement('option');
      option.value = value;
      option.label = label;
      this.src.appendChild(option);
    }

    if (this.multiple) {
      this.toggleMultiselectOption(selectGroupOption);
    } else {
      this.input.value = label;
      this.src.value = value;
      this.input.focus();
      this.closeDropdown();

      this.dropdown.querySelector('.bsddsel-group-option.selected')?.classList.remove('selected');
      selectGroupOption.classList.add('selected');
      this.src.dispatchEvent(new Event('input', {bubbles: true}));
    }
  }

  /**
   * When multiple items is enabled, this is called to toggle whether an option is selected. If selecting an item, a
   * tag is added to the form control, the option gets the selected class, and the value is added to this.src.val(). If
   * deselecting an item, the tag is removed from the form control, the value removed from $src.val(), and the option
   * loses the selected class
   * @param {HTMLDivElement} selectGroupOption
   */
  toggleMultiselectOption(selectGroupOption) {
    const value = selectGroupOption.dataset.value;
    const label = selectGroupOption.dataset.label;
    const options = Array.from(this.src.options);
    const selectedOption = options.find(opt => opt.value === value);
    if (selectedOption.selected) {
      // deselecting item
      selectGroupOption.classList.remove('selected');
      this.trg.querySelector(`.multiselect-tag[data-value='${value}']`).remove();
      selectedOption.selected = false;
      if (!options.some(o => o.selected)) this.input.placeholder = this.options.placeholder;
    } else {
      // selecting item
      selectGroupOption.classList.add('selected');
      this.renderMultiselectTag(label, value);
      selectedOption.selected = true;

      // clearing search field
      if (this.input.value.length > 0) {
        this.input.value = '';
        this.input.focus();
        this.renderOptions();
      }
    }
    this.src.dispatchEvent(new Event('input', {bubbles: true}));
  }

  /**
   *
   * @param {string} value
   */
  deselectMultiselectOption(value) {
    const allOptions = Array.from(this.src.options);
    const targetOption = allOptions.find(o => o.value === value);
    if (targetOption) targetOption.selected = false;
    this.trg.querySelector(`.multiselect-tag[data-value='${value}']`)?.remove();
    this.trg.querySelector(`.bsddsel-group-option[data-value='${value}']`)?.classList.remove('selected');
    if (this.src.selectedOptions.length === 0) this.input.placeholder = this.options.placeholder;
    this.src.dispatchEvent(new Event('input', {bubbles: true}));
  }

  deselectLastMultiselectOption() {
    const allTags = Array.from(this.trg.querySelectorAll('.multiselect-tag'));
    if (allTags.length > 0) {
      const lastVal = allTags[allTags.length - 1].dataset.value;
      this.deselectMultiselectOption(lastVal);
    }
  }

  clearSelection() {
    if (this.src.value !== '') {
      this.src.value = '';
      this.src.dispatchEvent(new Event('input', {bubbles: true}));
    }
    this.input.value = '';
    this.dropdown.querySelector('.bsddsel-group-option.selected')?.classList.remove('selected');
  }

  // Event handlers

  /**
   *
   * @param {FocusEvent} e
   */
  blurHandler(e) {
    // if the window itself loses focus, the event is fired but the active element remains. so we check that and
    // cancel closing the dropdown
    const closestActive = document.activeElement.closest('.bsddsel-form-group');
    if (closestActive === this.trg) return;

    const closestRelated = e.relatedTarget?.closest('.bsddsel-form-group');
    if (!e.relatedTarget || closestRelated !== this.trg) {
      this.closeDropdown();
    }
  }

  selectGroupOptionKeyDownHandler(e) {
    if (e.key === 'Enter') {
      this.makeSelection(e.target);
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.focusNextOption();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.focusPreviousOption();
    } else if (e.key === 'Escape') {
      e.target.blur();
    } else if (e.keyCode >= 65 && e.keyCode <= 90) {
      // typing activates the search bar and the character that is pressed is sent to the input
      this.input.focus();
    } else if (e.key === 'Backspace') {
      this.input.focus();
      if (!this.input.value || this.input.value.length === 0) {
        this.deselectLastMultiselectOption();
      }
    }
  }

  /**
   *
   * @param {PointerEvent} e
   */
  trgClickHandler(e) {
    if (e.target.classList.contains('form-control') || e.target === this.input) {
      this.input.focus();
      if (!this.dropdownIsOpen()) this.openDropdown();
      return;
    }

    if (e.target.classList.contains('bsddsel-dropdown-indicator')) {
      this.input.focus();
      if (!this.dropdownIsOpen()) {
        this.openDropdown();
      }
      return;
    }

    if (e.target.classList.contains('form-control-clear')) {
      this.clearSelection();
      this.input.focus();
      if (this.options.url) {
        this.debouncedSearchQueryChanged(null);
      }
      return;
    }

    const selGroupOption = e.target.closest('.bsddsel-group-option');
    if (selGroupOption) {
      this.makeSelection(selGroupOption);
      return;
    }

    if (e.target.matches('.multiselect-tag .fa-xmark')) {
      const value = e.target.closest('.multiselect-tag').dataset.value;
      this.deselectMultiselectOption(value);
    }
  }

  registerEvents() {
    const that = this;
    this.input.addEventListener('focus', function (e) {
      that.openDropdown();
    });
    this.input.addEventListener('input', function (e) {
      if (!that.dropdownIsOpen()) {
        that.openDropdown();
      }

      if (!that.options.url) {
        // render local search
        that.renderOptions(that.input.value);
      }

      if (that.multiple) {
        return;
      }

      // clear selection on search change
      that.src.value = '';

      if (that.debounceTimer) {
        clearTimeout(that.debounceTimer);
      }
      const q = e.currentTarget.value;
      that.debounceTimer = setTimeout(() => that.debouncedSearchQueryChanged(q), 500);
    });
    this.input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        that.focusNextOption();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        that.focusPreviousOption();
      } else if (e.key === 'Enter') {
        const open = that.dropdownIsOpen();
        if (open) {
          that.closeDropdown();
          e.preventDefault();
        }
      } else if (e.key === 'Escape') {
        e.currentTarget.blur();
      } else if (e.key === 'Backspace' && that.multiple) {
        // delete selected item if multiple are supported
        const val = e.currentTarget.value;
        if (!val || val.length === 0) {
          that.deselectLastMultiselectOption();
        }
      }
    });

    this.trg.addEventListener('click', function (e) {
      that.trgClickHandler(e);
    });

    this.dropdown.addEventListener('keydown', function (e) {
      if (e.target.classList.contains('bsddsel-group-option')) {
        that.selectGroupOptionKeyDownHandler(e);
      }
    });

    this.trg.addEventListener('focusout', function (e) {
      that.blurHandler(e);
    });
  }
}
