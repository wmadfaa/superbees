use std::env;
use sha2::{Digest, Sha256};
const N_LEADING_ZEROS_REQUIRED: usize = 13;

fn solve_challenge(challenge: &str) -> u64 {
    let mut curr = 0;
    loop {
        let input = format!("{}{}", curr, challenge);
        let result = Sha256::digest(input.as_bytes());
        let hex_string = format!("{:x}", result);

        let j = (N_LEADING_ZEROS_REQUIRED + 3) / 4;
        let k = &hex_string[..j];
        let l = u64::from_str_radix(k, 16).unwrap();

        if l < 2u64.pow(4 * j as u32 - N_LEADING_ZEROS_REQUIRED as u32) {
            return curr;
        } else {
            curr += 1;
        }
    }
}

fn main() {
   let args: Vec<String> = env::args().collect();
   if args.len() < 2 {
        panic!("Missing challenges");
   }
   let c: Vec<String> = serde_json::from_str(&args[1]).unwrap();
   let solutions: Vec<u64> = c
        .iter()
        .map(|challenge| solve_challenge(challenge))
        .collect();
   let result = serde_json::to_string(&solutions).unwrap();
   println!("{}", result);
}