// Ten made-up study screens for testing Casting. Each has a question, the pieces that answer it (`expect`),
// and decoys the question is not about. Pieces with an `id` get a true box in samples/truth.json.
module.exports = [
  {
    name: '01-dijkstra-pdf', chrome: 'pdf', file: 'cs331-lecture14-shortest-paths.pdf', page: '4 / 18',
    question: 'how does the relaxation equation fit into the algorithm?', expect: ['relax', 'alg'], optional: ['relaxtext'],
    blocks: [
      { h1: 'Lecture 14: Shortest paths' }, { meta: "CS 331 · Dijkstra's algorithm and the relaxation step" },
      { h: '14.1 Setup' }, { p: 'Every vertex starts with an estimate of its distance from the source s:' },
      { eq: String.raw`d[s] = 0, \qquad d[v] = \infty \ \text{ for all } v \neq s`, id: 'init' },
      { h: '14.2 Relaxation' }, { p: 'For an edge from u to v with weight w(u,v), the estimate for v improves whenever going through u is shorter:', id: 'relaxtext' },
      { eq: String.raw`d[v] = \min\big(d[v],\ d[u] + w(u,v)\big)`, id: 'relax' },
      { h: '14.3 The algorithm' },
      { code: 'for each neighbor v of u:\n    alt = d[u] + w(u, v)\n    if alt < d[v]:\n        d[v] = alt\n        prev[v] = u', id: 'alg' },
      { p: 'With a binary heap the running time is O((V + E) log V). Section 14.4 shows why negative weights break the argument.' },
    ],
  },
  {
    name: '02-gradient-descent-notebook', chrome: 'notebook', file: 'week6_linear_regression.ipynb',
    question: 'how does the update rule map onto this code?', expect: ['update', 'loop'],
    blocks: [
      { md: [{ h: 'Gradient descent' }, { p: 'We minimise the cost' }, { eq: String.raw`J(\theta) = \frac{1}{2m}\sum_{i=1}^{m}\big(h_\theta(x^{(i)}) - y^{(i)}\big)^2`, id: 'cost' },
        { p: 'by repeatedly stepping against the gradient:' }, { eq: String.raw`\theta \leftarrow \theta - \eta\, \nabla_\theta J(\theta)`, id: 'update' }] },
      { cell: 'import numpy as np\nX, y = load_data("houses.csv")\nm, n = X.shape', n: 1 },
      { cell: 'theta = np.zeros(n)\nlr = 0.01\nfor step in range(1000):\n    grad = X.T @ (X @ theta - y) / m\n    theta = theta - lr * grad', n: 2, id: 'loop' },
      { cell: 'plt.plot(history)\nplt.xlabel("step"); plt.ylabel("cost")', n: 3, out: '[<matplotlib.lines.Line2D at 0x7f2c>]' },
    ],
  },
  {
    name: '03-binary-search-slides', chrome: 'slides', file: 'Algorithms - Week 3.pptx', foot: 'CSE 241 · Slide 12',
    question: 'why is this recurrence the running time of this code?', expect: ['rec', 'code'],
    blocks: [
      { h1: 'Binary search: running time' },
      { eq: String.raw`T(n) = T\!\left(\tfrac{n}{2}\right) + O(1) \;\Rightarrow\; T(n) = O(\log n)`, id: 'rec' },
      { code: 'def binary_search(a, target):\n    lo, hi = 0, len(a) - 1\n    while lo <= hi:\n        mid = (lo + hi) // 2\n        if a[mid] == target:\n            return mid\n        elif a[mid] < target:\n            lo = mid + 1\n        else:\n            hi = mid - 1\n    return -1', id: 'code' },
    ],
  },
  {
    name: '04-bayes-browser', chrome: 'browser', tab: 'Module 5: Conditional probability', url: 'courses.example.edu/stat200/module5/bayes', course: 'STAT 200',
    nav: ['1. Counting', '2. Probability rules', '3. Random variables', '4. Expectation', '5. Conditional probability', '6. Distributions'],
    question: "what does each part of Bayes' theorem mean?", expect: ['bayes'], optional: ['intro'],
    blocks: [
      { meta: 'Modules › 5. Conditional probability' }, { h1: "5.3 Bayes' theorem" },
      { p: 'If B can happen in several disjoint ways, the law of total probability says' },
      { eq: String.raw`P(B) = \sum_{i} P(B \mid A_i)\,P(A_i)`, id: 'total' },
      { p: "Bayes' theorem turns a conditional probability around:", id: 'intro' },
      { eq: String.raw`P(A \mid B) = \frac{P(B \mid A)\,P(A)}{P(B)}`, id: 'bayes' },
      { h: 'Example' }, { p: 'A test is 95% accurate and 1% of people have the condition. What is the chance that someone who tests positive has it? Work it out before reading on.' },
    ],
  },
  {
    name: '05-softmax-notebook', chrome: 'notebook', file: 'lab3_classifier.ipynb',
    question: 'how does the softmax formula become this numpy code?', expect: ['softmax', 'impl'],
    blocks: [
      { md: [{ h: 'From scores to probabilities' }, { eq: String.raw`\operatorname{softmax}(z)_i = \frac{e^{z_i}}{\sum_{j=1}^{K} e^{z_j}}`, id: 'softmax' },
        { p: 'Training then minimises the cross-entropy loss' }, { eq: String.raw`L = -\sum_{i=1}^{K} y_i \log \hat{y}_i`, id: 'xent' }] },
      { cell: 'def softmax(z):\n    z = z - np.max(z)          # for numerical stability\n    e = np.exp(z)\n    return e / np.sum(e)', n: 4, id: 'impl' },
      { cell: 'softmax(np.array([2.0, 1.0, 0.1]))', n: 5, out: 'array([0.659, 0.242, 0.099])' },
    ],
  },
  {
    name: '06-mse-pdf', chrome: 'pdf', file: 'ml-notes-ch2-loss-functions.pdf', page: '7 / 31',
    question: 'how does this code compute the mean squared error?', expect: ['mse', 'code'],
    blocks: [
      { h1: '2.2 Loss functions' }, { p: 'A loss function measures how far predictions are from the targets. Two common choices for regression:' },
      { eq: String.raw`\text{MAE} = \frac{1}{n}\sum_{i=1}^{n} \lvert y_i - \hat{y}_i \rvert`, id: 'mae' },
      { eq: String.raw`\text{MSE} = \frac{1}{n}\sum_{i=1}^{n} \left(y_i - \hat{y}_i\right)^2`, id: 'mse' },
      { p: 'MSE punishes large errors more heavily because the difference is squared.' },
      { code: 'def mse(y, y_hat):\n    total = 0.0\n    for yi, pi in zip(y, y_hat):\n        total += (yi - pi) ** 2\n    return total / len(y)', id: 'code' },
    ],
  },
  {
    name: '07-fibonacci-browser', chrome: 'browser', tab: 'Dynamic programming intro', url: 'courses.example.edu/cs202/week7/dp', course: 'CS 202',
    nav: ['5. Recursion', '6. Divide and conquer', '7. Dynamic programming', '8. Greedy algorithms'],
    question: 'how does the memoized version implement this recurrence?', expect: ['rec', 'memo'],
    blocks: [
      { meta: 'Modules › 7. Dynamic programming' }, { h1: '7.1 Fibonacci, two ways' },
      { eq: String.raw`F(n) = F(n-1) + F(n-2), \qquad F(0) = 0,\; F(1) = 1`, id: 'rec' },
      { h: 'Naive recursion: exponential time' },
      { code: 'def fib(n):\n    if n < 2:\n        return n\n    return fib(n - 1) + fib(n - 2)', id: 'naive' },
      { h: 'Memoized: linear time' },
      { code: 'memo = {0: 0, 1: 1}\ndef fib(n):\n    if n not in memo:\n        memo[n] = fib(n - 1) + fib(n - 2)\n    return memo[n]', id: 'memo' },
    ],
  },
  {
    name: '08-matmul-slides', chrome: 'slides', file: 'Linear Algebra for CS - Lecture 9.pptx', foot: 'MATH 221 · Slide 5',
    question: 'which loop is the sum in this formula?', expect: ['formula', 'loops'],
    blocks: [
      { h1: 'Matrix multiplication' },
      { eq: String.raw`C_{ij} = \sum_{k=1}^{n} A_{ik}\, B_{kj}`, id: 'formula' },
      { code: 'for i in range(n):\n    for j in range(n):\n        C[i][j] = 0\n        for k in range(n):\n            C[i][j] += A[i][k] * B[k][j]', id: 'loops' },
      { p: 'Three nested loops of length n: O(n³) multiplications.' },
    ],
  },
  {
    name: '09-knn-pdf', chrome: 'pdf', file: 'cs189-note03-nearest-neighbours.pdf', page: '2 / 9',
    question: 'where does the distance formula appear in this code?', expect: ['dist', 'code'],
    blocks: [
      { h1: 'Note 3: k-nearest neighbours' }, { p: 'To classify a point x, find the k training points closest to it and take a majority vote.' },
      { h: 'Distance' }, { eq: String.raw`d(x, y) = \sqrt{\sum_{i=1}^{p} (x_i - y_i)^2}`, id: 'dist' },
      { p: 'Other distances work too; the Manhattan distance replaces the square and root with an absolute value.' },
      { h: 'Implementation' },
      { code: 'def predict(x, X_train, y_train, k=5):\n    d = np.sqrt(((X_train - x) ** 2).sum(axis=1))\n    nearest = np.argsort(d)[:k]\n    return np.bincount(y_train[nearest]).argmax()', id: 'code' },
    ],
  },
  {
    name: '10-quicksort-browser', chrome: 'browser', tab: 'Sorting II: quicksort', url: 'courses.example.edu/cs202/week4/quicksort', course: 'CS 202',
    nav: ['3. Sorting I', '4. Sorting II', '5. Recursion', '6. Divide and conquer'],
    question: 'what does this partition function do, step by step?', expect: ['partition'],
    blocks: [
      { meta: 'Modules › 4. Sorting II' }, { h1: '4.2 Partitioning' },
      { p: 'Quicksort picks a pivot, moves smaller elements to its left and larger ones to its right, then sorts each side.' },
      { code: 'def partition(a, lo, hi):\n    pivot = a[hi]\n    i = lo\n    for j in range(lo, hi):\n        if a[j] < pivot:\n            a[i], a[j] = a[j], a[i]\n            i += 1\n    a[i], a[hi] = a[hi], a[i]\n    return i', id: 'partition' },
      { p: 'On average the running time is' }, { eq: String.raw`T(n) = O(n \log n)`, id: 'avg' },
    ],
  },
  // Screens 11 to 15: text, tables and figures. `optional` pieces may be picked or not without counting as wrong.
  {
    name: '11-balance-sheet-slides', chrome: 'slides', file: 'ACCT 101 - Chapter 1.pptx', foot: 'ACCT 101 · Slide 20',
    question: "I don't understand stockholders' equity", expect: ['equity'], optional: ['bs'],
    blocks: [
      { h1: 'The balance sheet: what it tells you' },
      { bullets: [
        'Assets are the resources a company owns or controls, such as cash, inventory and equipment.',
        'Liabilities are what the company owes to others, such as bank loans and unpaid supplier bills.',
        "Stockholders' equity is the owners' claim on the assets: whatever would remain if every liability were paid off. Creditors are paid before owners, so equity acts as a cushion for them.",
      ], ids: ['assets', 'liab', 'equity'] },
      { table: [['', 'Year end'], ['Total assets', '$500,000'], ['Total liabilities', '$300,000'], ["Stockholders' equity", '$200,000']], id: 'bs' },
    ],
  },
  {
    name: '12-photosynthesis-pdf', chrome: 'pdf', file: 'bio110-ch3-energy.pdf', page: '6 / 22',
    question: 'what is this diagram showing?', expect: ['leaf'],
    blocks: [
      { h1: '3.1 Photosynthesis' },
      { p: 'Plants capture light energy and store it as sugar. The overall reaction takes in carbon dioxide and water and gives off oxygen:', id: 'intro' },
      { eq: String.raw`6\,\mathrm{CO_2} + 6\,\mathrm{H_2O} \xrightarrow{\text{light}} \mathrm{C_6H_{12}O_6} + 6\,\mathrm{O_2}`, id: 'rxn' },
      { svg: `<svg width="560" height="300" viewBox="0 0 560 300" xmlns="http://www.w3.org/2000/svg" font-family="Georgia, serif" font-size="16">
        <defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#333"/></marker></defs>
        <rect width="560" height="300" fill="#f6faf2" stroke="#cdd8c4"/>
        <path d="M150 230 C 190 90, 350 70, 420 115 C 380 205, 250 255, 150 230 Z" fill="#8cc06b" stroke="#4d7a35" stroke-width="2"/>
        <path d="M150 230 L 420 115" stroke="#4d7a35" stroke-width="2"/>
        <line x1="95" y1="45" x2="225" y2="135" stroke="#d9a400" stroke-width="3" marker-end="url(#ar)"/><text x="40" y="38">sunlight</text>
        <line x1="40" y1="175" x2="165" y2="175" stroke="#333" stroke-width="2" marker-end="url(#ar)"/><text x="30" y="165">CO₂ in</text>
        <line x1="350" y1="175" x2="480" y2="235" stroke="#333" stroke-width="2" marker-end="url(#ar)"/><text x="455" y="260">O₂ out</text>
        <line x1="215" y1="292" x2="230" y2="225" stroke="#2d6fb3" stroke-width="2" marker-end="url(#ar)"/><text x="235" y="290">water from roots</text>
        <text x="330" y="90">sugar made in the leaf</text></svg>`, id: 'leaf' },
    ],
  },
  {
    name: '13-supply-demand-browser', chrome: 'browser', tab: 'Week 2: Markets', url: 'courses.example.edu/econ101/week2/equilibrium', course: 'ECON 101',
    nav: ['1. Scarcity and choice', '2. Supply and demand', '3. Elasticity', '4. Consumer choice'],
    question: 'why does the price end up where the two lines cross?', expect: ['chart'], optional: ['def'],
    blocks: [
      { meta: 'Modules › 2. Supply and demand' }, { h1: '2.4 Market equilibrium' },
      { p: 'The equilibrium price is the price at which the quantity buyers want equals the quantity sellers offer. Above it there is a surplus; below it, a shortage.', id: 'def' },
      { svg: `<svg width="480" height="330" viewBox="0 0 480 330" xmlns="http://www.w3.org/2000/svg" font-family="Segoe UI, sans-serif" font-size="15">
        <line x1="60" y1="20" x2="60" y2="290" stroke="#222" stroke-width="2"/><line x1="60" y1="290" x2="450" y2="290" stroke="#222" stroke-width="2"/>
        <text x="8" y="30">Price</text><text x="380" y="315">Quantity</text>
        <line x1="80" y1="40" x2="420" y2="270" stroke="#2d6fb3" stroke-width="3"/><text x="425" y="270" fill="#2d6fb3">D</text>
        <line x1="80" y1="270" x2="420" y2="40" stroke="#c0392b" stroke-width="3"/><text x="425" y="45" fill="#c0392b">S</text>
        <line x1="60" y1="155" x2="250" y2="155" stroke="#888" stroke-dasharray="5 4"/><line x1="250" y1="155" x2="250" y2="290" stroke="#888" stroke-dasharray="5 4"/>
        <circle cx="250" cy="155" r="6" fill="#222"/><text x="260" y="148">E</text><text x="30" y="160">P*</text><text x="242" y="310">Q*</text></svg>`, id: 'chart' },
      { h: 'Elasticity, briefly' },
      { p: 'Elasticity measures how strongly the quantity demanded responds to a change in price. It is the subject of next week.', id: 'elastic' },
    ],
  },
  {
    name: '14-mitosis-pdf', chrome: 'pdf', file: 'bio110-ch5-cell-division.pdf', page: '3 / 15',
    question: 'what happens during anaphase?', expect: ['anaphase'],
    blocks: [
      { h1: '5.2 The phases of mitosis' }, { meta: 'BIO 110 · Lecture 9' },
      { p: 'In prophase, the chromosomes condense and become visible, and the spindle begins to form.', id: 'prophase' },
      { p: 'In metaphase, the chromosomes line up along the middle of the cell, attached to spindle fibres from both poles.', id: 'metaphase' },
      { p: 'In anaphase, the sister chromatids are pulled apart and move to opposite ends of the cell.', id: 'anaphase' },
      { p: 'In telophase, a nuclear envelope forms around each set of chromosomes and the cell begins to divide in two.', id: 'telophase' },
      { p: 'Cytokinesis, the splitting of the cytoplasm, usually overlaps with telophase.' },
    ],
  },
  {
    name: '15-income-statement-browser', chrome: 'browser', tab: 'Chapter 2: Income statement', url: 'courses.example.edu/acct101/ch2/income-statement', course: 'ACCT 101',
    nav: ['1. The balance sheet', '2. The income statement', '3. Cash flows', '4. Adjusting entries'],
    question: 'how is net income calculated in this table?', expect: ['is'], optional: ['def', 'note'],
    blocks: [
      { meta: 'Modules › 2. The income statement' }, { h1: '2.1 Reading an income statement' },
      { p: 'The income statement reports how much a company earned over a period. Expenses are subtracted from revenue step by step until only net income is left.', id: 'def' },
      { table: [['Income statement, 2026', ''], ['Revenue', '$820,000'], ['Cost of goods sold', '(410,000)'], ['Gross profit', '410,000'], ['Operating expenses', '(250,000)'], ['Income tax', '(40,000)'], ['Net income', '$120,000']], id: 'is' },
      { p: 'Amounts in brackets are subtracted.', id: 'note' },
    ],
  },
  // Screens 16 to 19: using apps and reading screens in place. Casting should choose point mode and return targets.
  {
    name: '16-spreadsheet-app', chrome: 'app', title: 'budget.xlsx — Spreadsheet', mode: 'point',
    question: 'how do I make a chart from this data?', expect: ['chart'], optional: ['insert', 'data'],
    blocks: [],
    html: `<div class="menubar"><div>File</div><div>Edit</div><div>View</div><div data-piece="insert" data-kind="target">Insert</div><div>Format</div><div>Data</div><div>Help</div></div>
      <div class="toolbar"><div class="tb">↶</div><div class="tb">↷</div><div class="sep"></div><div class="tb"><b>B</b></div><div class="tb"><i>I</i></div><div class="tb"><u>U</u></div>
      <div class="sep"></div><div class="tb">Σ</div><div class="tb lab" data-piece="chart" data-kind="target">▥ Chart</div><div class="tb lab">⧩ Filter</div><div class="tb lab">↕ Sort</div></div>
      <table class="sheet"><tr><th></th><th>A</th><th>B</th><th>C</th><th>D</th><th>E</th></tr>
      <tbody data-piece="data" data-kind="target"><tr><td class="rh">1</td><td><b>Month</b></td><td><b>Sales</b></td><td></td><td></td><td></td></tr>
      <tr><td class="rh">2</td><td>January</td><td>1,200</td><td></td><td></td><td></td></tr><tr><td class="rh">3</td><td>February</td><td>1,450</td><td></td><td></td><td></td></tr>
      <tr><td class="rh">4</td><td>March</td><td>1,320</td><td></td><td></td><td></td></tr><tr><td class="rh">5</td><td>April</td><td>1,780</td><td></td><td></td><td></td></tr></tbody>
      <tr><td class="rh">6</td><td></td><td></td><td></td><td></td><td></td></tr><tr><td class="rh">7</td><td></td><td></td><td></td><td></td><td></td></tr></table>`,
  },
  {
    name: '17-settings-app', chrome: 'app', title: 'Settings', mode: 'point',
    question: 'where do I turn on dark mode?', expect: ['appearance'],
    blocks: [],
    html: `<div class="settings"><div class="side"><div class="on">General</div><div data-piece="appearance" data-kind="target">Appearance</div><div>Notifications</div><div>Privacy</div><div>Accounts</div><div>About</div></div>
      <div class="panel"><h2>General</h2><div class="row-set">Start at login<div class="tog on"></div></div><div class="row-set">Check for updates automatically<div class="tog on"></div></div>
      <div class="row-set">Send usage statistics<div class="tog"></div></div><div class="row-set">Language<div class="btn">English ▾</div></div></div></div>`,
  },
  {
    name: '18-error-dialog', chrome: 'app', title: 'report.docx — Writer', mode: 'point',
    question: 'what does this mean and what should I do?', expect: ['msg'], optional: ['saveas', 'retry', 'title'],
    blocks: [],
    html: `<div class="menubar"><div>File</div><div>Edit</div><div>View</div><div>Insert</div><div>Format</div></div>
      <div style="padding:40px 120px;font:16px Georgia,serif;color:#333;line-height:1.7">Quarterly report draft. Revenue grew in every region this quarter, led by the northern stores...</div>
      <div class="dialog-back"><div class="dialog"><h3 data-piece="title" data-kind="target">Couldn't save</h3>
      <div data-piece="msg" data-kind="target">report.docx could not be saved because the disk is full. Free up some space, or save the file to a different location.</div>
      <div class="btns"><div class="btn">Cancel</div><div class="btn" data-piece="retry" data-kind="target">Retry</div><div class="btn primary" data-piece="saveas" data-kind="target">Save As…</div></div></div></div>`,
  },
  {
    name: '19-sales-dashboard', chrome: 'browser', tab: 'Sales dashboard', url: 'dashboard.example.com/sales/2026', course: 'Dashboard', mode: 'point',
    nav: ['Overview', 'Sales', 'Customers', 'Inventory'],
    question: 'which month had the highest sales?', expect: ['peak'], optional: ['chart'],
    blocks: [
      { meta: 'Sales › 2026' }, { h1: 'Monthly sales' },
      { svg: `<svg width="620" height="340" viewBox="0 0 620 340" xmlns="http://www.w3.org/2000/svg" font-family="Segoe UI, sans-serif" font-size="14" data-piece="chart" data-kind="target">
        <line x1="50" y1="20" x2="50" y2="290" stroke="#999"/><line x1="50" y1="290" x2="600" y2="290" stroke="#999"/>
        <rect x="80" y="170" width="60" height="120" fill="#7aa7e0"/><text x="95" y="312">Jan</text>
        <rect x="170" y="145" width="60" height="145" fill="#7aa7e0"/><text x="185" y="312">Feb</text>
        <rect x="260" y="158" width="60" height="132" fill="#7aa7e0"/><text x="273" y="312">Mar</text>
        <rect x="350" y="112" width="60" height="178" fill="#7aa7e0" data-piece="peak" data-kind="target"/><text x="366" y="312">Apr</text>
        <rect x="440" y="150" width="60" height="140" fill="#7aa7e0"/><text x="455" y="312">May</text>
        <text x="8" y="30">Sales</text></svg>` },
      { p: 'Figures in thousands of dollars.' },
    ],
  },
];
