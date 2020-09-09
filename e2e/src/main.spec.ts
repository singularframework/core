import 'source-map-support/register';

import './dev.spec';
import './prod.spec';

after(function() {

  // Kill the process
  setTimeout(() => process.exit(), 500);

})
