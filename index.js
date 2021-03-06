{
	// shorthands
	var _delta = bundle.DeltaBalances;
	var _util = bundle.utility;

	// initiation
	var initiated = false;
	var autoStart = false;

	var web3Index = 0;  //last used web3 instance
	
	var requestID = 0;

	// loading states
	var table1Loaded = false;

	var exchanges =
		{
			'Wallet': {
				enabled: true,
				loaded: 0, //async loading progress, number of tokens
				displayed: 0, //async loading progress, number of tokens
				contract: undefined
			},
			'EtherDelta': {
				enabled: true,
				loaded: 0,
				displayed: 0,
				contract: _delta.config.contractEtherDeltaAddrs[0].addr
			},
			'IDEX': {
				enabled: false,
				loaded: 0,
				displayed: 0,
				contract: _delta.config.contractIdexAddr
			},
			'Token store': {
				enabled: false,
				loaded: 0,
				displayed: 0,
				contract: _delta.config.contractTokenStoreAddr
			},
			'Decentrex': {
				enabled: false,
				loaded: 0,
				displayed: 0,
				contract: _delta.config.contractDecentrexAddr
			},
		};


	var loadedBid = 0;

	var loadedCustom = false;
	var trigger_1 = false;
	var running = false;

	// settings
	var hideZero = true;
	var decimals = false;
	var fixedDecimals = 3;
	var useAsk = false;

	var showCustomTokens = false;
	var showDollars = true;


	// user input & data
	var publicAddr = '';
	var saved = false;
	var savedAddr = '';
	var lastResult = undefined;

	// config
	var tokenCount = 0; //auto loaded
	var blocktime = 14;
	var blocknum = -1;
	var startblock = 0;
	var endblock = 'latest';
	var walletWarningBalance = 0.003;

	var balances = {};
	var etherPrice = 0;

	// placeholder
	var balancesPlaceholder = {
		"0x0000000000000000000000000000000000000000":
			{
				Name: 'ETH',
				Wallet: 0,
				EtherDelta: 0,
				IDEX: 0,
				'Token store': 0,
				Decentrex: 0,
				Total: 0,
				Unlisted: false,
				Address: '',
				Bid: '',
				Ask: '',
				'Est. ETH': '',
			},
	};


	init();

	$(document).ready(function () {
		readyInit();
	});

	function init() {
		_delta.startDeltaBalances(() => {
			_delta.initTokens(true);

			showTokenCount();//checkCustom();
			initiated = true;
			if (autoStart)
				myClick();
		});
	}

	function readyInit() {
		getStorage();

		showTokenCount();
		$('#zero').prop('checked', hideZero);
		$('#decimals').prop('checked', decimals);
		$('#custom').prop('checked', showCustomTokens);
		$('#dollars').prop('checked', showDollars);


        $('body').on('expanded.pushMenu collapsed.pushMenu', function() {
           // Add delay to trigger code only after the pushMenu animation completes
            setTimeout(function() {
                $("#resultTable").trigger("update", [true, () => { }]);
                $("#resultTable").trigger("applyWidgets");
            }, 300);
        } );



		// detect enter & keypresses in input
		$('#address').keypress(function (e) {
			if (e.keyCode == 13) {
				myClick();
				return false;
			} else {
				hideError();
				return true;
			}
		});

		$(window).resize(function () {
            $("#resultTable").trigger("applyWidgets");

			//hide popovers
			$('[data-toggle="popover"]').each(function () {
				$(this).popover('hide');
				$(this).data("bs.popover").inState = { click: false, hover: false, focus: false };
			});

			checkCollapseSettings();
		});

		//dismiss popovers on click outside
		$('body').on('click', function (e) {
			$('[data-toggle="popover"]').each(function () {
				//the 'is' for buttons that trigger popups
				//the 'has' for icons within a button that triggers a popup
				if (!$(this).is(e.target) && $(this).has(e.target).length === 0 && $('.popover').has(e.target).length === 0) {
					$(this).popover('hide');
					$(this).data("bs.popover").inState = { click: false, hover: false, focus: false };
				}
			});
			if (!$('#refreshButtonSearch').is(e.target)) {
				hideError();
			}
		});


		// contract change
		$('#contractSelect').change(e => {
			_delta.changeContract(e.target.selectedIndex);
			if (document.getElementById('address').value !== '')
				myClick();
		});

		resetExLoadingState();
		Object.keys(exchanges).forEach(function (key) {
			initExchangeBox(key);
		});
		setBalanceProgress();
		placeholderTable();

		checkCollapseSettings();

		// url parameter ?addr=0x... /#0x..
		var addr = getParameterByName('addr');
		if (!addr) {
			var hash = window.location.hash;  // url parameter /#0x...
			if (hash)
				addr = hash.slice(1);
		}
		if (addr) {
			addr = getAddress(addr);
			if (addr) {
				publicAddr = addr;
				autoStart = true;
				// auto start loading
				myClick();
			}
		}
		else if (publicAddr) {
			autoStart = true;
			myClick();
		} else if (savedAddr) {//autoload when remember is active
			publicAddr = savedAddr;
			autoStart = true;
			// auto start loading
			loadSaved();
		}
		else {
			_delta.connectSocket();
			$('#address').focus();
		}
	}

	function checkCollapseSettings() {
		let width = $(window).width();
		if (width < 991) {
			if ($('#setting-body').is(":visible")) {
				$("[data-widget='collapse']").click();
			}
		} else {
			if (!$('#setting-body').is(":visible")) {
				$("[data-widget='collapse']").click();
			}
		}
	}

	function initExchangeBox(name) {

		let name2 = name;
		if (name2 == 'Token store')
			name2 = 'store';
		let id = '#' + name2;
		let boxId = id + 'Box';

		let enabled = $(id).prop('checked');
		if (enabled != exchanges[name].enabled) {
			$(id).prop("checked", exchanges[name].enabled);
			$(boxId).removeClass('box-success');
			$(boxId).removeClass('box-warning');

			if (exchanges[name].enabled) {
				$(boxId).addClass('box-success');
			} else {
				$(boxId).addClass('box-warning');
			}
		}

	}

	function checkExchange(name) {
		let id = '#' + name;
		let boxId = id + 'Box';

		if (name == 'store')
			name = 'Token store';
		let enabled = $(id).prop('checked');


		$(boxId).removeClass('box-success');
		$(boxId).removeClass('box-warning');
		if (enabled) {
			$(boxId).addClass('box-success');
		} else {
			$(boxId).addClass('box-warning');
		}
		$("#resultTable").trigger("destroy");
		$('#resultTable tbody').html('');
		$('#resultTable thead').html('');
		table1Loaded = false;

		if (exchanges[name].enabled != enabled) {
			exchanges[name].enabled = enabled;
			if (lastResult) {
				if (!enabled) {
					//hide loaded exchange, don't reload
					balanceHeaders[name] = exchanges[name].enabled;
					finishedBalanceRequest();
				} else {
					if (exchanges[name].loaded >= tokenCount) {
						//show hidden exchange result
						balanceHeaders[name] = exchanges[name].enabled;
						finishedBalanceRequest();
					} else {

						// load new exchange only, keep old
						getBalances(requestID, true, false);
					}
				}
			} else {
				remakeEmpty();
			}
		} else {
			exchanges[name].enabled = enabled;
			remakeEmpty();
		}

		setStorage();

		function remakeEmpty() {

			resetExLoadingState();
			placeholderTable();
			setBalanceProgress();
		}
	}

	// zero balances checkbox
	var changeZero = false;
	function checkZero() {
		changeZero = true;
		hideZero = $('#zero').prop('checked');
		if (lastResult) {
			$('#resultTable tbody').empty();
			makeTable(lastResult, hideZero);
		}
		changeZero = false;
		setStorage();
	}

	function checkAsk() {
		useAsk = $('#ask').prop('checked');

		$("#resultTable").trigger("destroy");
		$('#resultTable tbody').html('');
		$('#resultTable thead').html('');
		table1Loaded = false;

		if (lastResult) {
			finishedBalanceRequest();
			//makeTable(lastResult, hideZero);
		} else {
			placeholderTable();
		}
	}

	function checkDollars() {
		showDollars = $('#dollars').prop('checked');

		$('#ethbalancePrice').html('');
		$('#tokenbalancePrice').html('');
		$('#totalbalancePrice').html('');

		if (showDollars && lastResult) {
			finishedBalanceRequest();
		}
		setStorage();
	}

	// more decimals checbox
	var changedDecimals = false;
	function checkDecimal() {
		changedDecimals = true;
		decimals = $('#decimals').prop('checked');

		fixedDecimals = decimals ? 8 : 3;

		$('#resultTable tbody').empty();
		$('#resultTable thead').empty();


		if (lastResult) {
			//table1Loaded = false;
			//	table2Loaded = false;
			makeTable(lastResult, hideZero);
		} else {
			placeholderTable();
		}
		changedDecimals = false;
		setStorage();
	}

	function checkCustom() {
		showCustomTokens = $('#custom').prop('checked');
		$('#customMessage').prop('hidden', showCustomTokens);
		setStorage();
		let maxcount = Object.keys(_delta.uniqueTokens).length;
		if (showCustomTokens) {
			tokenCount = maxcount;
			if (lastResult && loadedCustom) {
				setBalanceProgress();
				makeTable(lastResult, hideZero);
			}
			else if (publicAddr) {
				// load only added custom tokens if listed already loaded
				getBalances(requestID, false, true);
			}

		}
		else {
			tokenCount = _delta.config.tokens.length;

			if (lastResult) {
				setBalanceProgress();
				makeTable(lastResult, hideZero);
			}
		}
		showTokenCount();
	}

	function showTokenCount() {
		let maxcount = Object.keys(_delta.uniqueTokens).length;
		let currentcount = maxcount;
		if (showCustomTokens) {
			currentcount = maxcount;
		} else {
			currentcount = _delta.config.tokens.length;
		}
		$('#tokencount').html(" " + currentcount + "/" + maxcount);
	}

	function disableInput(disable) {
		$('#refreshButton').prop('disabled', disable);
		// $("#address").prop("disabled", disable);
		$("#loadingBalances").prop("disabled", disable);
		$("#tablesearcher").prop("disabled", disable);
		if (disable)
			$('#loadingBalances').addClass('dim');
		else
			$('#loadingBalances').removeClass('dim');
	}

	function showLoading(balance, trans) {
		if (balance) {
			$('#loadingBalances').addClass('fa-spin');
			$('#loadingBalances').addClass('dim');
			$('#loadingBalances').prop('disabled', true);
			$('#loadingBalances').show();
			$('#refreshButtonLoading').show();
			$('#refreshButtonSearch').hide();
		}
		$("#tablesearcher").prop("disabled", balance);

		/*if (!balance) {
			$('#refreshButtonLoading').hide();
			$('#refreshButtonSearch').show();
		} */
	}

	function buttonLoading(balance, trans) {
		if (!publicAddr) {
			hideLoading(balance, trans);
			return;
		}
		if (balance) {
			$('#loadingBalances').removeClass('fa-spin');
			$('#loadingBalances').removeClass('dim');
			$('#loadingBalances').prop('disabled', false);
			$('#loadingBalances').show();
			$('#refreshButtonLoading').hide();
			$('#refreshButtonSearch').show();
		}
	}

	function hideLoading(balance, trans) {
		if (!publicAddr) {
			balance = true;
			trans = true;
			$('#refreshButtonLoading').hide();
			$('#refreshButtonSearch').show();
		}
		if (balance) {
			if (!trans)
				$('#loadingBalances').removeClass('fa-spin');
			else
				$('#loadingBalances').hide();
		}

		$("#tablesearcher").prop("disabled", !balance);
		if (balance) {
			$('#refreshButtonLoading').hide();
			$('#refreshButtonSearch').show();

		}
	}

	function myClick() {
		if (running)
			requestID++;
		if (!initiated) {
			autoStart = true;
			return;
		}

		hideError();
		hideHint();
		//disableInput(true);
		$('#downloadBalances').html('');

		// validate address
		if (!autoStart)
			publicAddr = getAddress();

		autoStart = false;
		if (publicAddr) {
			window.location.hash = publicAddr;
			getAll(false, requestID);

		}
		else {
			//placeholder();
			console.log('invalid input');
			disableInput(false);
			hideLoading(true, true);
		}
	}

	function getAll(autoload, rqid) {
		running = true;

		trigger_1 = true;

		lastResult = undefined;

		if (publicAddr) {
			setStorage();
			window.location.hash = publicAddr;
			getBalances(rqid, false, false);

		} else {
			running = false;
		}
	}

	function resetExLoadingState() {

		function setLoad(name) {
			exchanges[name].loaded = exchanges[name].enabled ? 0 : -1;
			exchanges[name].displayed = !exchanges[name].enabled;
			balanceHeaders[name] = exchanges[name].enabled;
		}

		Object.keys(exchanges).forEach(function (key) {
			setLoad(key);
		});
	}

	function appendExLoadingState(addCustom) {

		function setLoad(name) {
			if (exchanges[name].enabled && ((addCustom && exchanges[name].loaded >= _delta.config.tokens.length) || (!addCustom && exchanges[name].loaded >= tokenCount))) {
				exchanges[name].displayed = false;
			} else {
				exchanges[name].loaded = exchanges[name].enabled ? 0 : -1;
				exchanges[name].displayed = !exchanges[name].enabled;
			}
			balanceHeaders[name] = exchanges[name].enabled;
		}

		Object.keys(exchanges).forEach(function (key) {
			setLoad(key);
		});
	}

	function getBalances(rqid, appendExchange, appendCustom) {
		if (!rqid)
			rqid = requestID;
		if (!trigger_1)
			return;

		if (!appendExchange && !appendCustom)
			balances = {};

		$('#ethbalance').html('');
		$('#tokenbalance').html('');
		$('#totalbalance').html('');

		$('#ethbalancePrice').html('');
		$('#tokenbalancePrice').html('');
		$('#totalbalancePrice').html('');

		$('#downloadBalances').html('');

		trigger_1 = false;
		//disableInput(true);

		loadedBid = 0;

		loadedCustom = false;
		$('#resultTable tbody').empty();
		showLoading(true, false);

		var allCount = Object.keys(_delta.uniqueTokens).length;
		var allTokens = Object.values(_delta.uniqueTokens);
		if (!showCustomTokens) {
			tokenCount = _delta.config.tokens.length;
		} else {
			tokenCount = allCount;
		}

		if (!appendExchange && !appendCustom)
			resetExLoadingState();
		else
			appendExLoadingState(appendCustom);

		setBalanceProgress();

		if (!appendExchange && !appendCustom) {
			for (var i = 0; i < allCount; i++) {
				var token = allTokens[i];
				if (token)
					initBalance(token);
			}
		}

		//getAllBalances(rqid, 'All');
		Object.keys(exchanges).forEach(function (key) {
			if (exchanges[key].enabled && exchanges[key].loaded < tokenCount) {
				getAllBalances(rqid, key, appendCustom);
			}
		});

		getPrices(rqid);
		getEtherPrice();

		function initBalance(tokenObj, customToken) {
			balances[tokenObj.addr] = {
				Name: tokenObj.name,
				Wallet: '',
				EtherDelta: '',
				IDEX: 0,
				'Token store': 0,
				Decentrex: 0,
				Total: 0,
				Bid: '',
				Ask: '',
				'Est. ETH': '',
				Unlisted: tokenObj.unlisted,
				Address: tokenObj.addr,
			};
		}

	}

	function getEtherPrice() {
		$.getJSON('https://api.coinmarketcap.com/v1/ticker/ethereum/', result => {

			if (result && result[0].price_usd) {
				etherPrice = result[0].price_usd;
			}
		});

	}


	// check if input address is valid
	function getAddress(addr) {

		setAddrImage('');
		document.getElementById('currentAddr').innerHTML = '0x......' // side menu
		document.getElementById('currentAddr2').innerHTML = '0x......'; //top bar
		document.getElementById('currentAddrDescr').innerHTML = 'Input address';

		var address = '';
		address = addr ? addr : document.getElementById('address').value;
		address = address.trim();

		if (!_delta.web3.isAddress(address)) {
			//check if url ending in address
			if (address.indexOf('/0x') !== -1) {
				var parts = address.split('/');
				var lastSegment = parts.pop() || parts.pop();  // handle potential trailing slash
				if (lastSegment)
					address = lastSegment;
			}

			if (!_delta.web3.isAddress(address)) {
				if (address.length == 66 && address.slice(0, 2) === '0x') {
					// transaction hash, go to transaction details
					window.location = window.location.origin + window.location.pathname + '/../tx.html#' + address;
					return;
				}

				// possible private key, show warning   (private key, or tx without 0x)
				if (address.length == 64 && address.slice(0, 2) !== '0x') {
					if (!addr) // ignore if in url arguments
					{
						showError("You likely entered your private key, NEVER do that again");
					}
				}
				else if (address.length == 40 && address.slice(0, 2) !== '0x') {
					address = `0x${addr}`;

				}
				else {
					if (!addr) // ignore if in url arguments
					{
						showError("Invalid address, try again");
					}
					return undefined;
				}
				if (!_delta.web3.isAddress(address)) {
					if (!addr) // ignore if in url arguments
					{
						showError("Invalid address, try again");
					}
					return undefined;
				}
			}
		}

		document.getElementById('address').value = address;
		document.getElementById('currentAddr').innerHTML = address.slice(0, 16); // side menu
		document.getElementById('currentAddr2').innerHTML = address.slice(0, 8); //top bar
		$('#walletInfo').removeClass('hidden');
		if (!savedAddr || address.toLowerCase() !== savedAddr.toLowerCase()) {
			$('#save').removeClass('hidden');
			if (savedAddr) {
				$('#savedSection').removeClass('hidden');
			}
		} else if (savedAddr && address.toLowerCase() === savedAddr.toLowerCase()) {
			$('#save').addClass('hidden');
			$('#savedSection').addClass('hidden');
			document.getElementById('currentAddrDescr').innerHTML = 'Saved address';
		}

		$('#etherscan').attr("href", _util.addressLink(address, false, false))
		document.getElementById('addr').innerHTML = _util.addressLink(address, true, false);
		setAddrImage(address);

		return address;
	}

	function setAddrImage(addr) {

		var icon = document.getElementById('addrIcon');
		var icon2 = document.getElementById('currentAddrImg');
		var icon3 = document.getElementById('userImage');

		if (addr) {
			icon.style.backgroundImage = 'url(' + blockies.create({ seed: addr.toLowerCase(), size: 8, scale: 16 }).toDataURL() + ')';
			var smallImg = 'url(' + blockies.create({ seed: addr.toLowerCase(), size: 8, scale: 4 }).toDataURL() + ')';
			icon2.style.backgroundImage = smallImg;
			icon3.style.backgroundImage = smallImg;
		} else {
			icon.style.backgroundImage = '';
			icon2.style.backgroundImage = '';
			icon3.style.backgroundImage = '';
		}
	}

	function setSavedImage(addr) {
		var icon = document.getElementById('savedImage');
		if (addr)
			icon.style.backgroundImage = 'url(' + blockies.create({ seed: addr.toLowerCase(), size: 8, scale: 4 }).toDataURL() + ')';
		else
			icon.style.backgroundImage = '';
	}


	// get parameter from url
	function getParameterByName(name, url) {
		if (!url) url = window.location.href;
		name = name.replace(/[\[\]]/g, "\\$&");
		var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
			results = regex.exec(url);
		if (!results) return null;
		if (!results[2]) return '';
		return decodeURIComponent(results[2].replace(/\+/g, " "));
	}


	function getPrices(rqid) {
		var socketRetries = 0;
		var urlRetries = 4; // disabled
		var pricesLoaded = false;
		var numRetries = 4;

		/*disable price request due to ED server issues */
		/*	{ 
				loadedBid = -1;
				finishedBalanceRequest();
				urlRetries = numRetries; //disable url request for now;
		}*/

		retrySocket();
		//retryURL();


		function retrySocket() {
			_delta.socketTicker((err, result, rid) => {
				if (requestID <= rqid) {
					if (!err && result) {
						parsePrices(result);
					} else if (loadedBid < 1 && socketRetries < numRetries) {
						socketRetries++;
						retrySocket();
					} else if (socketRetries >= numRetries && urlRetries >= numRetries) {
						showError("Failed to retrieve EtherDelta Prices after 5 tries. Try again (later)");
						loadedBid = -1;
						finishedBalanceRequest();
					}
				}
			}, rqid);
		}

		function retryURL() {
			$.getJSON(_delta.config.apiServer + '/returnTicker').done((result) => {
				if (requestID <= rqid) {
					if (result) {
						parsePrices(result);
					} else if (loadedBid < 1 && urlRetries < numRetries) {
						urlRetries++;
						retryURL();
					} else if (socketRetries >= numRetries && urlRetries >= numRetries) {
						showError("Failed to retrieve EtherDelta Prices after 5 tries. Try again (later)");
						loadedBid = -1;
						finishedBalanceRequest();
					}
				}
			}).fail((result) => {
				if (requestID <= rqid) {
					if (loadedBid < 1 && urlRetries < numRetries) {
						urlRetries++;
						retryURL();
					}
					else if (socketRetries >= numRetries && urlRetries >= numRetries) {
						showError("Failed to retrieve EtherDelta Prices after 5 tries. Try again (later)");
						loadedBid = -1;
						finishedBalanceRequest();
					}
				}
			});
		}

		function parsePrices(result) {
			var results = Object.values(result);
			for (var i = 0; i < results.length; i++) {
				var token = _delta.uniqueTokens[results[i].tokenAddr];

				if (token && balances[token.addr]) {
					balances[token.addr].Bid = Number(results[i].bid);
					balances[token.addr].Ask = Number(results[i].ask);
				}
			}
			loadedBid = 1;
			finishedBalanceRequest();
			return;
		}
	}


	var maxPerRequest = 500;   // don't make the web3 requests too large
	// mode = 'All' or ''  is all balances in 1 request
	// 'Wallet' is only wallet balances
	// 'EtherDelta' is only Etherdelta balances
	function getAllBalances(rqid, mode, addCustom) {

		// select which tokens to be requested
		var tokens2 = Object.keys(_delta.uniqueTokens);
		if (addCustom && showCustomTokens) {
			tokens2 = tokens2.filter((x) => { return _delta.uniqueTokens[x].unlisted });
		} else if (!showCustomTokens) {
			tokens2 = tokens2.filter((x) => { return !_delta.uniqueTokens[x].unlisted });
		}

		//split in separate requests to match maxPerRequest
		for (var i = 0; i < tokens2.length; i += maxPerRequest) {
			allBalances(i, i + maxPerRequest, tokens2, i);
		}

		// make the call to get balances for a (sub)section of tokens
		function allBalances(startIndex, endIndex, tokens3, balanceRequestIndex) {

			var tokens = tokens3.slice(startIndex, endIndex);

			var functionName = 'deltaBalances';
			var arguments = [exchanges[mode].contract, publicAddr, tokens];
			if (mode == 'Wallet') {
				functionName = 'walletBalances';
				arguments = [publicAddr, tokens];
			}

			var completed = 0;
			var success = false;
			var totalTries = 0;

			if(web3Index >= _delta.web3s.length) {
				web3Index = 0;
			}
			
			//get balances from 2 web3 sources at once, use the fastest response
			// web3 provider (infura, myetherapi, mycryptoapi) or etherscan
			makeCall(_delta.web3s[web3Index], mode, functionName, arguments, 0);
			makeCall( web3Index >= _delta.web3s.length ? undefined : _delta.web3s[web3Index], mode, functionName, arguments, 0); 


			function makeCall(web3Provider, exName, funcName, args, retried) {
				
				if(completed || requestID > rqid)
					return;
				if(web3Provider)
					web3Index++;
				
				_util.call(
					web3Provider,
					_delta.contractDeltaBalance,
					_delta.config.contractDeltaBalanceAddr,
					funcName,
					args,
					(err, result) => {
						if (success || requestID > rqid)
							return;
						
						completed++;
						
						const returnedBalances = result;

						if (!err && returnedBalances && returnedBalances.length > 0) {
							loadedCustom = showCustomTokens;
							for (var i = 0; i < tokens.length; i++) {
								var token = _delta.uniqueTokens[tokens[i]];
								var div = _delta.divisorFromDecimals(token.decimals);

								if (funcName == 'walletBalances' || funcName == 'deltaBalances') {
									balances[token.addr][exName] = _util.weiToEth(returnedBalances[i], div);
									if (exchanges[exName].loaded >= 0)
										exchanges[exName].loaded++;
									if (exchanges[exName].loaded >= tokenCount)
										finishedBalanceRequest();
									
									success = true;
								}/* else { //both wallet & etherdelta
									var j = i * 2;
									balances[token.addr].EtherDelta = _util.weiToEth(returnedBalances[j], div);
									balances[token.addr].Wallet = _util.weiToEth(returnedBalances[j + 1], div);
									loadedW++;
									loadedED++;
									if (loadedED >= tokenCount && loadedW >= tokenCount)
										finishedBalanceRequest();
								} */
							}
						}
						else if (completed >= 2) // both requests returned
						{
							const retryAmount = 2;
							if (retried < retryAmount) //retry both etherscan and infura 3 times
							{
								totalTries++;
								console.log('retrying request');
								if(web3Index >= _delta.web3s.length) {
									web3Index = 0;
								}
								
								makeCall(_delta.web3s[web3Index], exName, funcName, args, retried + 1);
								makeCall(web3Index >= _delta.web3s.length ? undefined : _delta.web3s[web3Index], exName, funcName, args, retried + 1);
								return;
							}
							else if (totalTries >= retryAmount * 2) {

								if (funcName == 'walletBalances') {
									showError('Failed to load all Wallet balances after 3 tries, try again later');
									exchanges[exName].loaded = -1;
									finishedBalanceRequest();
								}
								else if (funcName == 'deltaBalances') {
									showError('Failed to load all ' + exName + ' balances after 3 tries, try again later');
									exchanges[exName].loaded = -1;
									finishedBalanceRequest();
								}
							}
						}
					}
				);
			}
		}
	}



	function showHint(text) {
		$('#hinttext').html(text);
		$('#hint').show();
	}

	function hideHint() {
		$('#hint').hide();
	}

	function showError(text) {
		$('#errortext').html(text);
		$('#error').show();
	}

	function hideError() {
		$('#error').hide();
	}

	function setBalanceProgress() {
		let progressString = '<span style="padding-left:10px;padding-right:30px">Loaded: </span>';
		let changed = false;
		let keys = Object.keys(exchanges);
		for (let i = 0; i < keys.length; i++) {

			if (exchanges[keys[i]].enabled) {
				if (changed)
					progressString +=
						changed = true;
				var numLoaded = exchanges[keys[i]].loaded;
				progressString += '<span>' + keys[i] + ":";

				if (numLoaded >= tokenCount) {
					progressString += '<span style="padding-left:3px;padding-right:30px" class="text-green">';
				} else {
					progressString += '<span style="padding-left:3px;padding-right:30px" class="text-red">';
				}
				progressString += Math.min(exchanges[keys[i]].loaded, tokenCount) + '/' + tokenCount + '</span></span> ';
			}
		}

		//prices
		{
			progressString += '<span>Token prices:';
			if (loadedBid == 0) {
				progressString += '<span style="padding-left:3px;padding-right:30px" class="text-red"> No </span></span>';
			} else if (loadedBid == 1) {
				progressString += '<span style="padding-left:3px;padding-right:30px" class="text-green"> Yes </span></span>';
			} else {
				progressString += '<span style="padding-left:3px;padding-right:30px" class="text-red"> Failed </span></span>';
			}
		}

		$('#balanceProgress').html(progressString);
	}


	// callback when balance request completes
	function finishedBalanceRequest() {
		//check if all requests are complete
		let keys = Object.keys(exchanges);

		var noneDone = true;
		var allDone = true;
		for (let i = 0; i < keys.length; i++) {
			if (exchanges[keys[i]].loaded >= tokenCount || exchanges[keys[i]].loaded == -1) {
				if (exchanges[keys[i]].enabled)
					noneDone = false;
			} else if (exchanges[keys[i]].enabled) {
				allDone = false;
			}
		}

		setBalanceProgress();

		if (noneDone)
			return;


		var sumETH = 0;
		var sumToken = 0;

		for (let i = 0; i < keys.length; i++) {
			exchanges[keys[i]].displayed = exchanges[keys[i]].loaded >= tokenCount || exchanges[keys[i]].loaded == -1;
		}

		displayedBid = loadedBid >= 1 || loadedBid <= -1;

		var allCount = Object.keys(_delta.uniqueTokens).length;
		var allTokens = Object.values(_delta.uniqueTokens);

		// get totals
		for (var i = 0; i < allCount; i++) {
			var token = allTokens[i];
			var bal = balances[token.addr];
			if (bal) {

				bal.Total = 0;
				for (let i = 0; i < keys.length; i++) {
					if (exchanges[keys[i]].enabled && exchanges[keys[i]].loaded >= tokenCount) {
						bal.Total += Number(bal[keys[i]]);
					}
				}

				bal['Est. ETH'] = '';

				// ETH and  wrapped eth fixed at value of 1 ETH
				if (_util.isWrappedETH(token.addr)){
					bal.Bid = '';
					bal.Ask = '';
					bal['Est. ETH'] = bal.Total;

					if (token.addr === "0x0000000000000000000000000000000000000000") {
						sumETH = bal.Total;
					} else {
						sumToken += bal.Total;
					}
				}
				else if ((bal.Bid || (useAsk && bal.Ask)) && bal.Total) {
					// calculate estimate if not (wrapped) ETH
					var val;
					if (!useAsk)
						val = Number(bal.Bid) * Number(bal.Total);
					else
						val = Number(bal.Ask) * Number(bal.Total);
					bal['Est. ETH'] = val;
					sumToken += val;
				}

				if (!bal.Bid) {
					bal.Bid = '';
				}
				if (!bal.Ask) {
					bal.Ask = '';
				}

				balances[token.addr] = bal;
			}
		}

		var result = Object.values(balances);
		lastResult = result;

		if (allDone) {
			$('#ethbalance').html(sumETH.toFixed(fixedDecimals) + ' ETH');
			$('#tokenbalance').html(sumToken.toFixed(fixedDecimals) + ' ETH');
			$('#totalbalance').html((sumETH + sumToken).toFixed(fixedDecimals) + ' ETH');

			if (showDollars) {
				$('#ethbalancePrice').html(" $" + numberCommas((sumETH * etherPrice).toFixed(2)));
				$('#tokenbalancePrice').html(" $" + numberCommas((sumToken * etherPrice).toFixed(2)));
				$('#totalbalancePrice').html(" $" + numberCommas(((sumETH + sumToken) * etherPrice).toFixed(2)));
			}


			$('#downloadBalances').html('');
			downloadBalances();

		} else {

			$('#ethbalance').html('');
			$('#tokenbalance').html('');
			$('#totalbalance').html('');

			$('#ethbalancePrice').html('');
			$('#tokenbalancePrice').html('');
			$('#totalbalancePrice').html('');

			$('#downloadBalances').html('');
		}


		/*if (showCustomTokens)
			lastResult3 = result;
			*/

		makeTable(result, hideZero); //calls trigger
	}



	//balances table
	function makeTable(result, hideZeros) {

		$('#resultTable tbody').empty();
		var filtered = result;
		var loaded = table1Loaded;
		if (changedDecimals)
			loaded = false;

		if (hideZeros) {
			filtered = result.filter(x => {
				return (Number(x.Total) > 0 || x.Name === 'ETH');
			});
		}
		/*
		if(!showCustomTokens)
		{
			filtered = result.filter(x => {
				return !(x.Unlisted);
            });
		} */

		balanceHeaders['Ask'] = useAsk;
		balanceHeaders['Bid'] = !useAsk;
		buildHtmlTable('#resultTable', filtered, loaded, 'balances', balanceHeaders);

		trigger();
	}


	function placeholderTable() {
		balances = balancesPlaceholder;
		var result = Object.values(balancesPlaceholder);
		makeTable(result, false);
	}


	// save address for next time
	function setStorage() {
		if (typeof (Storage) !== "undefined") {

			if (publicAddr) {
				sessionStorage.setItem('address', publicAddr);
			} else {
				sessionStorage.removeItem('address');
			}
			if (savedAddr) {
				localStorage.setItem("address", savedAddr);
			} else {
				localStorage.removeItem('address');
			}

			localStorage.setItem("customTokens", showCustomTokens);
			localStorage.setItem("decimals", decimals);
			localStorage.setItem("hideZero", hideZero);
			localStorage.setItem('usd', showDollars);

			Object.keys(exchanges).forEach(function (key) {
				localStorage.setItem(key, exchanges[key].enabled);
			});
		}
	}

	function getStorage() {
		if (typeof (Storage) !== "undefined") {

			if (localStorage.getItem("usd") === null) {
				showDollars = true;
			} else {
				showDollars = localStorage.getItem('usd');
				if (showDollars === "false")
					showDollars = false;
			}

			if (localStorage.getItem("customTokens") === null) {
				showCustomTokens = false;
			} else {
				var custom = localStorage.getItem('customTokens');
				showCustomTokens = custom === "true";
			}

			if (localStorage.getItem("hideZero") === null) {
				hideZero = true;
			} else {
				var zero = localStorage.getItem('hideZero');
				hideZero = zero === "true";
			}

			if (localStorage.getItem("decimals") === null) {
				decimals = false;
			} else {
				var dec = localStorage.getItem('decimals');
				decimals = dec === "true";
			}

			Object.keys(exchanges).forEach(function (key) {
				let enabled = localStorage.getItem(key);
				if (enabled !== null) {
					enabled = (enabled === "true");
					exchanges[key].enabled = enabled;
				}
				exchanges['Wallet'].enabled = true;
			});


			// check for saved address
			if (localStorage.getItem("address") !== null) {
				var addr = localStorage.getItem("address");
				if (addr && addr.length == 42) {
					savedAddr = addr;
					addr = getAddress(addr);
					if (addr) {
						savedAddr = addr;
						setSavedImage(savedAddr);
						$('#savedAddress').html(addr.slice(0, 16));
					}
				} else {
					localStorage.removeItem("address");
				}
			}

			// check for session address between pages
			if (sessionStorage.getItem("address") !== null) {
				var addr = sessionStorage.getItem("address");
				if (addr && addr.length == 42) {
					addr = getAddress(addr);
					if (addr) {
						publicAddr = addr;
					}
				} else {
					sessionStorage.removeItem("address");
				}
			}
		}
	}



	// final callback to sort table
	function trigger() {
		if (table1Loaded) // reload existing table
		{
			$("#resultTable").trigger("update", [true, () => { }]);
			$("#resultTable thead th").data("sorter", true);
			//$("table").trigger("sorton", [[0,0]]);

		} else {
			$("#resultTable thead th").data("sorter", true);
			$("#resultTable").tablesorter({
				widgets: ['scroller', 'filter'],
				widgetOptions: {
					filter_external: '.search',
					filter_defaultFilter: { 0: '~{query}' },
					filter_columnFilters: false,
					filter_placeholder: { search: 'Search...' }, 
					scroller_height: 500,
				},
				sortList: [[0, 0]]
			});

			table1Loaded = true;
		}

		let keys = Object.keys(exchanges);
		var allDisplayed = true;
		for (let i = 0; i < keys.length; i++) {
			if (!exchanges[keys[i]].displayed) {
				allDisplayed = false;
			}
		}
		allDisplayed = allDisplayed && displayedBid;
		trigger_1 = allDisplayed;


		if (trigger_1) {
			disableInput(false);
			hideLoading(true, true);
			running = false;
			requestID++;
			buttonLoading(true, true);
		}

		table1Loaded = true;
	}


	// Builds the HTML Table out of myList.
	function buildHtmlTable(selector, myList, loaded, type, headers) {
		var body = $(selector + ' tbody');
		var columns = addAllColumnHeaders(myList, selector, loaded, type, headers);

		for (var i = 0; i < myList.length; i++) {
			if (!showCustomTokens && myList[i].Unlisted)
				continue;
			var row$ = $('<tr/>');

			if (type === 'balances') {
				//if(!balances[myList[i].Name])
				//continue;
				for (var colIndex = 0; colIndex < columns.length; colIndex++) {
					var cellValue = myList[i][columns[colIndex]];
					if (cellValue == null) cellValue = "";
					var head = columns[colIndex];

					if (head == 'Total' || head == 'EtherDelta' || head == 'Decentrex' || head == 'Token store' || head == 'IDEX' || head == 'Wallet' || head == 'Bid' || head == 'Ask' || head == 'Est. ETH') {
						if (cellValue !== "" && cellValue !== undefined) {
							var dec = fixedDecimals;
							if (head == 'Bid' || head == 'Ask') {
								dec += 2;
							}
							var num = Number(cellValue).toFixed(dec);
							num = numberCommas(num);
							row$.append($('<td/>').html(num));
						} else {
							row$.append($('<td/>').html(cellValue));
						}

					}
					else if (head == 'Name') {
						let token = _delta.uniqueTokens[myList[i].Address];
						let popoverContents = "Placeholder";
						if (cellValue !== 'ETH') {
							if (token) {
								popoverContents = 'Contract: ' + _util.addressLink(token.addr, true, true) + '<br> Decimals: ' + token.decimals
									+ '<br> Trade on: <ul><li>' + _util.etherDeltaURL(token, true)
									+ '</li><li>' + _util.forkDeltaURL(token, true)
									+ '</li><li>' + _util.tokenStoreURL(token, true) + '</li>';
								if (token.IDEX) {
									popoverContents += '<li>' + _util.idexURL(token, true) + '</li>';
								}
								popoverContents += '</ul>';
							}
						} else {
							popoverContents = "Ether (not a token)<br> Decimals: 18";
						}
						let labelClass = 'label-warning';
						if (!myList[i].Unlisted)
							labelClass = 'label-primary';

						row$.append($('<td/>').html('<a tabindex="0" class="label ' + labelClass + '" role="button" data-html="true" data-toggle="popover" data-placement="auto right"  title="' + cellValue + '" data-container="body" data-content=\'' + popoverContents + '\'>' + cellValue + ' <i class="fa fa-external-link"></i></a>'));
					}
					else if (head == 'Date') {
						row$.append($('<td/>').html(formatDate(cellValue, false)));
					}
					else {
						row$.append($('<td/>').html(cellValue));
					}
				}
			}
			body.append(row$);
			$("[data-toggle=popover]").popover();
		}
	}

	var balanceHeaders = { 'Name': 1, 'Wallet': 1, 'EtherDelta': 1, 'IDEX': 1, 'Token store': 1, 'Decentrex': 1, 'Total': 1, 'Value': 1, 'Bid': 1, 'Ask': 0, 'Est. ETH': 1 };

	// Adds a header row to the table and returns the set of columns.
	// Need to do union of keys from all records as some records may not contain
	// all records.
	function addAllColumnHeaders(myList, selector, loaded, type, headers) {
		var columnSet = {};

		if (!loaded)
			$(selector + ' thead').empty();

		var header1 = $(selector + ' thead');
		var headerTr$ = $('<tr/>');

		if (!loaded) {
			header1.empty();
		}

		for (var i = 0; i < myList.length; i++) {
			var rowHash = myList[i];
			for (var key in rowHash) {
				if (!columnSet[key] && headers[key]) {
					columnSet[key] = 1;
					headerTr$.append($('<th/>').html(key));
				}
			}
		}
		if (!loaded) {
			header1.append(headerTr$);
			$(selector).append(header1);
		}
		columnSet = Object.keys(columnSet);
		return columnSet;
	}


	// contract selector
	function createSelect() {
		var div = document.getElementById("selectDiv");

		//Create array of options to be added
		var array = _delta.config.contractEtherDeltaAddrs.map(x => { return x.addr; });

		//Create and append select list
		var selectList = document.createElement("select");
		selectList.id = "contractSelect";
		var liveGroup = document.createElement("optgroup");
		liveGroup.label = "EtherDelta - Active";
		var oldGroup = document.createElement("optgroup");
		oldGroup.label = "EtherDelta - Outdated - withdraw funds";



		//Create and append the options
		for (var i = 0; i < array.length; i++) {
			var option = document.createElement("option");
			option.value = i;
			option.text = array[i];
			if (i == 0) {
				liveGroup.appendChild(option);
			} else {
				oldGroup.appendChild(option);
			}
		}


		selectList.appendChild(liveGroup);
		selectList.appendChild(oldGroup);
		div.appendChild(selectList);
		selectList.selectedIndex = 0;
	}


	function toDateTime(secs) {
		var utcSeconds = secs;
		var d = new Date(0);
		d.setUTCSeconds(utcSeconds);
		return d;
		//return formatDate(d);
	}

	function toDateTimeNow(short) {
		var t = new Date();
		return t; //formatDate(t, short);
	}

	function createUTCOffset(date) {

		function pad(value) {
			return value < 10 ? '0' + value : value;
		}

		var sign = (date.getTimezoneOffset() > 0) ? "-" : "+";
		var offset = Math.abs(date.getTimezoneOffset());
		var hours = pad(Math.floor(offset / 60));
		var minutes = pad(offset % 60);
		return sign + hours + ":" + minutes;
	}

	function formatDateOffset(d, short) {
		if (short)
			return formatDate(d, short);
		else
			return formatDateT(d, short) + createUTCOffset(d);
	}

	function formatDate(d, short) {
		var month = '' + (d.getMonth() + 1),
			day = '' + d.getDate(),
			year = d.getFullYear(),
			hour = d.getHours(),
			min = d.getMinutes();


		if (month.length < 2) month = '0' + month;
		if (day.length < 2) day = '0' + day;
		if (hour < 10) hour = '0' + hour;
		if (min < 10) min = '0' + min;

		if (!short)
			return [year, month, day].join('-') + ' ' + [hour, min].join(':');
		else
			return [year, month, day].join('');
	}

	function formatDateT(d, short) {
		if (d == "??")
			return "??";

		var month = '' + (d.getMonth() + 1),
			day = '' + d.getDate(),
			year = d.getFullYear(),
			hour = d.getHours(),
			min = d.getMinutes();


		if (month.length < 2) month = '0' + month;
		if (day.length < 2) day = '0' + day;
		if (hour < 10) hour = '0' + hour;
		if (min < 10) min = '0' + min;

		if (!short)
			return [year, month, day].join('-') + 'T' + [hour, min].join(':');
		else
			return [year, month, day].join('');
	}


	function downloadBalances() {
		if (lastResult) {
			var allBal = lastResult;
			allBal = allBal.filter((x) => { return x.Total > 0; });

			let bidText = 'EtherDelta Bid (ETH)';
			if (useAsk)
				bidText = 'EtherDelta Ask (ETH)';

			var AA = ['Token'];
			Object.keys(exchanges).forEach(function (key) {
				if (exchanges[key].enabled) {
					AA.push(key);
				}
			});

			AA = AA.concat(['Total', bidText, 'Estimated value (ETH)', 'Token contract address']);

			const A = [AA];
			// initialize array of rows with header row as 1st item
			for (var i = 0; i < allBal.length; ++i) {
				let bid = allBal[i].Bid;
				if (useAsk)
					bid = allBal[i].Ask;
				let estimate = '';
				if (bid)
					estimate = bid * allBal[i].Total

				var arr = [allBal[i].Name];
				Object.keys(exchanges).forEach(function (key) {
					if (exchanges[key].enabled) {
						arr.push(allBal[i][key]);
					}
				});

				let contrAddr = allBal[i].Address;
				if (arr[0] === 'ETH')
					contrAddr = 'Not a token';

				arr = arr.concat([allBal[i].Total, bid, estimate, contrAddr]);

				for (let j = 0; j < arr.length; j++) {
					//remove exponential notation
					if (A[0][j] == 'Wallet' || A[0][j] == 'EtherDelta' || A[0][j] == 'IDEX' || A[0][j] == 'Token store' || A[0][j] == 'Decentrex' || A[0][j] == 'Total' || A[0][j] == 'Estimated value (ETH)' || A[0][j] == 'EtherDelta Bid (ETH)' || A[0][j] == 'EtherDelta Ask (ETH)') {
						if (arr[j] != '' && arr[j] != ' ')
							arr[j] = exportNotation(arr[j]);
					}

					// add quotes
					//arr[j] = `\"${arr[j]}\"`;
				}

				A.push(arr);
			}
			var csvRows = [];
			for (var i = 0, l = A.length; i < l; ++i) {
				csvRows.push(A[i].join(','));   // unquoted CSV row
			}
			var csvString = csvRows.join("\r\n");

			var sp = document.createElement('span');
			sp.innerHTML = "Export balances as CSV ";
			var a = document.createElement('a');
			a.innerHTML = '<i class="fa fa-download" aria-hidden="true"></i>';
			a.href = 'data:application/csv;charset=utf-8,' + encodeURIComponent(csvString);
			a.target = '_blank';
			a.download = formatDate(toDateTimeNow(true), true) + '-' + publicAddr + '.csv';
			sp.appendChild(a);

			$('#downloadBalances').html('');
			var parent = document.getElementById('downloadBalances');
			parent.appendChild(sp);
			//parent.appendCild(a);
		}

	}

	//remove exponential notation 1e-8  etc.
	function exportNotation(num) {
		return Number(num).toFixed(20).replace(/\.?0+$/, ""); // rounded to 20 decimals, no trailing 0
	}



	function forget() {
		if (publicAddr) {
			if (publicAddr.toLowerCase() === savedAddr.toLowerCase()) {
				savedAddr = '';
				$('#savedSection').addClass('hidden');
			}
		}
		$('#address').val('');
		publicAddr = getAddress('');
		setStorage();
		window.location.hash = "";
		$('#walletInfo').addClass('hidden');

		myClick();

		return false;
	}

	function save() {
		savedAddr = publicAddr;
		publicAddr = getAddress(savedAddr);

		$('#savedAddress').html(savedAddr.slice(0, 16));
		$('#savedSection').addClass('hidden');
		$('#save').addClass('hidden');
		setSavedImage(savedAddr);
		setStorage();

		return false;
	}

	function loadSaved() {
		if (savedAddr) {

			publicAddr = savedAddr;
			publicAddr = getAddress(savedAddr);
			//$('#save').addClass('hidden');
			//$('#savedSection').addClass('hidden');
			myClick();
		}
		return false;
	}

	function numberCommas(num) {
		var n = num.toString(), p = n.indexOf('.');
		return n.replace(/\d(?=(?:\d{3})+(?:\.|$))/g, function ($0, i) {
			return p < 0 || i < p ? ($0 + ',') : $0;
		});
	}

}