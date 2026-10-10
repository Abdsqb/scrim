// Ten made-up study screens for testing Casting. Each has a question, the pieces that answer it (`expect`),
// and decoys the question is not about. Pieces with an `id` get a true box in samples/truth.json.
module.exports = [
  {
    name: '01-dijkstra-pdf', chrome: 'pdf', file: 'cs331-lecture14-shortest-paths.pdf', page: '4 / 18',
    question: 'how does the relaxation equation fit into the algorithm?', expect: ['relax', 'alg'],
    blocks: [
      { h1: 'Lecture 14: Shortest paths' }, { meta: "CS 331 · Dijkstra's algorithm and the relaxation step" },
      { h: '14.1 Setup' }, { p: 'Every vertex starts with an estimate of its distance from the source s:' },
      { eq: String.raw`d[s] = 0, \qquad d[v] = \infty \ \text{ for all } v \neq s`, id: 'init' },
      { h: '14.2 Relaxation' }, { p: 'For an edge from u to v with weight w(u,v), the estimate for v improves whenever going through u is shorter:' },
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
    question: "what does each part of Bayes' theorem mean?", expect: ['bayes'],
    blocks: [
      { meta: 'Modules › 5. Conditional probability' }, { h1: "5.3 Bayes' theorem" },
      { p: 'If B can happen in several disjoint ways, the law of total probability says' },
      { eq: String.raw`P(B) = \sum_{i} P(B \mid A_i)\,P(A_i)`, id: 'total' },
      { p: "Bayes' theorem turns a conditional probability around:" },
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
];
